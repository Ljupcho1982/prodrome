/*
 * Demo-data generator — 6 weeks of realistic signals with a planted prodrome
 * so a first-time user can see the rewind & fingerprint immediately.
 * (Same idea as the test worlds, trimmed for the UI.)
 */
(function (root) {
  'use strict';
  const HOUR = 3600 * 1000;

  function rand(seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  function build() {
    const r = rand(42);
    const now = Date.now();
    const days = 42;
    const start = now - days * 24 * HOUR;

    // 5 episodes across the last ~4 weeks
    const events = [];
    for (let i = 0; i < 5; i++) {
      const t = start + Math.round((0.35 + i * 0.13) * days * 24 * HOUR) + Math.floor(r() * 8 * HOUR);
      events.push({ id: 'e' + t.toString(36), ts: t, label: 'migraine', severity: 2 + Math.floor(r() * 4) });
    }
    const inWin = (ts) => events.some((e) => ts >= e.ts - 24 * HOUR && ts < e.ts);

    const signals = { restingHr: [], sleepDur: [], voiceRate: [], voicePause: [], voiceF0var: [] };
    for (let t = start; t <= now; t += 6 * HOUR) {
      const pre = inWin(t);
      // planted: HR rises, sleep drops, voice slows before episodes
      signals.restingHr.push({ ts: t, v: round(60 + (pre ? 9 : 0) + gauss(r) * 3) });
      signals.sleepDur.push({ ts: t, v: round(7.1 - (pre ? 1.4 : 0) + gauss(r) * 0.5, 2) });
      signals.voiceRate.push({ ts: t, v: round(4.2 - (pre ? 0.9 : 0) + gauss(r) * 0.3, 2) });
      signals.voicePause.push({ ts: t, v: round(0.22 + (pre ? 0.09 : 0) + gauss(r) * 0.03, 3) });
      signals.voiceF0var.push({ ts: t, v: round(18 + gauss(r) * 4, 1) }); // decoy: no real signal
    }
    return { events, signals, settings: { retainDays: 60, defaultLabel: 'migraine' }, createdAt: now, _demo: true };
  }

  function round(x, d) { d = d || 0; const f = Math.pow(10, d); return Math.round(x * f) / f; }
  root.ProdromeDemo = { build };
})(typeof self !== 'undefined' ? self : this);
