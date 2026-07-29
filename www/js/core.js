/*
 * Prodrome core engine — pure, deterministic, dependency-free.
 * Runs identically in the browser and in Node (for tests).
 *
 * The whole point of Prodrome: you tag an episode AFTER it starts, and the
 * engine rewinds your passive signals to find what drifted from YOUR OWN
 * normal in the hours before. No population averages, no cloud, no diagnosis —
 * just honest, explainable arithmetic on the user's device.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ProdromeCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HOUR = 3600 * 1000;

  // ---- robust statistics -------------------------------------------------
  function median(arr) {
    if (!arr.length) return NaN;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function mean(arr) {
    if (!arr.length) return NaN;
    let t = 0;
    for (const x of arr) t += x;
    return t / arr.length;
  }

  // Median Absolute Deviation — outlier-resistant spread.
  function mad(arr, med) {
    if (!arr.length) return NaN;
    const m = med === undefined ? median(arr) : med;
    const dev = arr.map((x) => Math.abs(x - m));
    return median(dev);
  }

  function robustBaseline(values) {
    const med = median(values);
    let spread = 1.4826 * mad(values, med); // ~= std for normal data
    if (!(spread > 0)) {
      // MAD collapses when >half the samples are identical; fall back to a
      // tiny floor so drift is finite instead of Infinity.
      const range = values.length ? Math.max(...values) - Math.min(...values) : 0;
      spread = range > 0 ? range / 4 : 1e-9;
    }
    return { median: med, spread: spread, n: values.length };
  }

  // "How far is x from MY normal", in robust standard deviations.
  function driftScore(x, baseline) {
    return (x - baseline.median) / baseline.spread;
  }

  // ---- signal windowing --------------------------------------------------
  function valuesIn(series, from, to) {
    const out = [];
    for (const p of series) if (p.ts >= from && p.ts < to) out.push(p.v);
    return out;
  }

  /*
   * For one event and one signal, compute how far the pre-window mean drifted
   * from the baseline established BEFORE that window.
   *   window:   [eventTs - windowH,  eventTs)
   *   baseline: [eventTs - windowH - baselineH, eventTs - windowH)
   * Returns null when there isn't enough data to be meaningful.
   */
  function eventDrift(series, eventTs, opt) {
    opt = withDefaults(opt); // self-defaulting so direct callers can pass {} or nothing
    const windowH = opt.windowHours;
    const baselineH = opt.baselineHours;
    const minWin = opt.minWindowSamples;
    const minBase = opt.minBaselineSamples;

    const winFrom = eventTs - windowH * HOUR;
    const win = valuesIn(series, winFrom, eventTs);
    const base = valuesIn(series, winFrom - baselineH * HOUR, winFrom);
    if (win.length < minWin || base.length < minBase) return null;

    const baseline = robustBaseline(base);
    return driftScore(mean(win), baseline);
  }

  // ---- fingerprint -------------------------------------------------------
  /*
   * Build the user's personal early-warning fingerprint across all tagged
   * events (optionally filtered to one label). For each signal:
   *   drift  = median drift across events (robust to a weird single episode)
   *   weight = fraction of events where the signal was "active" AND agreed in
   *            sign with the overall drift  => consistency / trustworthiness
   */
  function buildFingerprint(events, signalsObj, opt) {
    opt = withDefaults(opt);
    const evs = opt.label
      ? events.filter((e) => e.label === opt.label)
      : events.slice();

    const fp = {};
    for (const name of Object.keys(signalsObj)) {
      const series = signalsObj[name];
      const drifts = [];
      for (const e of evs) {
        const d = eventDrift(series, e.ts, opt);
        if (d !== null && isFinite(d)) drifts.push(d);
      }
      if (drifts.length < opt.minEventsPerSignal) continue;

      const overall = median(drifts);
      const sign = overall === 0 ? 0 : Math.sign(overall);
      let agree = 0;
      for (const d of drifts) {
        if (Math.abs(d) >= opt.activeThreshold && Math.sign(d) === sign) agree++;
      }
      fp[name] = {
        drift: round(overall, 3),
        weight: round(agree / drifts.length, 3),
        n: drifts.length,
      };
    }
    return fp;
  }

  // Rank signals by how much they actually carry the warning: weight * |drift|.
  function rankFingerprint(fp) {
    return Object.keys(fp)
      .map((name) => ({ name: name, ...fp[name], score: fp[name].weight * Math.abs(fp[name].drift) }))
      .sort((a, b) => b.score - a.score);
  }

  // ---- live "is a prodrome showing today?" -------------------------------
  /*
   * Compare the most recent window against the fingerprint. Returns which of
   * the user's known warning signs are active right now. Deliberately NOT a
   * single opaque risk score — it lists the evidence and lets the user judge.
   */
  function matchToday(signalsObj, fingerprint, opt, nowTs) {
    opt = withDefaults(opt);
    const now = nowTs === undefined ? Date.now() : nowTs;
    const considered = [];
    const active = [];
    for (const name of Object.keys(fingerprint)) {
      const fpSig = fingerprint[name];
      if (fpSig.weight < opt.minWeightForHeadsUp) continue;
      const series = signalsObj[name];
      if (!series) continue;
      const d = eventDrift(series, now, opt); // "event = now"
      if (d === null || !isFinite(d)) continue;
      considered.push(name);
      const matchesSign = Math.sign(d) === Math.sign(fpSig.drift);
      if (matchesSign && Math.abs(d) >= opt.activeThreshold) {
        active.push({ name: name, drift: round(d, 2), expected: fpSig.drift });
      }
    }
    return {
      active: active,
      consideredCount: considered.length,
      fraction: considered.length ? active.length / considered.length : 0,
    };
  }

  // ---- options / helpers -------------------------------------------------
  const DEFAULTS = {
    windowHours: 24, // how far back the "pre-window" reaches
    baselineHours: 24 * 14, // 14-day trailing normal
    minWindowSamples: 3,
    minBaselineSamples: 8,
    minEventsPerSignal: 2,
    minWeightForHeadsUp: 0.5,
    activeThreshold: 1.5, // robust SDs from normal to count as "active"
    label: null,
  };
  function withDefaults(opt) {
    return Object.assign({}, DEFAULTS, opt || {});
  }
  function round(x, dp) {
    const f = Math.pow(10, dp);
    return Math.round(x * f) / f;
  }

  return {
    HOUR,
    median,
    mean,
    mad,
    robustBaseline,
    driftScore,
    valuesIn,
    eventDrift,
    buildFingerprint,
    rankFingerprint,
    matchToday,
    DEFAULTS,
  };
});
