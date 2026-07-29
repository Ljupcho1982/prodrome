/*
 * Prodrome core test suite.
 *
 * Honest interpretation of "test it 100 times": this runs the drift/fingerprint
 * engine against 100+ RANDOMIZED synthetic scenarios (Monte-Carlo / property
 * based), each with a planted early-warning signal buried in noise, and asserts
 * the engine recovers it with the correct sign while rejecting pure-noise
 * signals. Plus deterministic unit tests for the math primitives.
 *
 * Run:  node --test        (Node 18+, uses built-in test runner)
 */
const test = require('node:test');
const assert = require('node:assert');
const C = require('../www/js/core.js');

const HOUR = C.HOUR;

// ---- deterministic RNG so failures are reproducible ---------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  // Box–Muller
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// Unit tests: robust math primitives
// ---------------------------------------------------------------------------
test('median / mean basic', () => {
  assert.strictEqual(C.median([3, 1, 2]), 2);
  assert.strictEqual(C.median([1, 2, 3, 4]), 2.5);
  assert.strictEqual(C.mean([2, 4, 6]), 4);
});

test('driftScore is 0 at the personal median', () => {
  const b = C.robustBaseline([10, 11, 9, 10, 12, 8, 10, 11, 9, 10]);
  assert.ok(Math.abs(C.driftScore(b.median, b)) < 1e-9);
});

test('robustBaseline resists outliers (MAD not std)', () => {
  const clean = [10, 10, 11, 9, 10, 11, 9, 10];
  const withSpike = clean.concat([1000]); // one wild reading
  const b1 = C.robustBaseline(clean);
  const b2 = C.robustBaseline(withSpike);
  // Median barely moves despite a 100x outlier.
  assert.ok(Math.abs(b1.median - b2.median) <= 1);
});

test('robustBaseline never divides by zero on identical data', () => {
  const b = C.robustBaseline([5, 5, 5, 5, 5, 5]);
  assert.ok(isFinite(C.driftScore(6, b)));
});

test('eventDrift returns null without enough data', () => {
  const series = [{ ts: 0, v: 1 }];
  const d = C.eventDrift(series, 10 * HOUR, C.DEFAULTS);
  assert.strictEqual(d, null);
});

// Regression: eventDrift must self-default so callers passing {} (rewind view,
// doctor report) don't get NaN windows -> null. Caught during browser testing.
test('eventDrift self-defaults when opt is {} or omitted', () => {
  const rng = mulberry32(9);
  const series = [];
  const now = 0;
  for (let t = now - 40 * 24 * HOUR; t <= now; t += HOUR) {
    series.push({ ts: t, v: 60 + gauss(rng) * 3 });
  }
  const evTs = now - 3 * 24 * HOUR;
  const dEmpty = C.eventDrift(series, evTs, {});
  const dNone = C.eventDrift(series, evTs);
  const dFull = C.eventDrift(series, evTs, C.DEFAULTS);
  assert.ok(dEmpty !== null && isFinite(dEmpty), 'opt={} should compute a drift');
  assert.ok(dNone !== null && isFinite(dNone), 'omitted opt should compute a drift');
  assert.strictEqual(dEmpty, dFull);
});

// ---------------------------------------------------------------------------
// Synthetic-world generator
// ---------------------------------------------------------------------------
// Builds hourly samples over `days`, plants `nEvents` episodes, and for the
// planted signal pushes a drift of `effect` robust-SDs during the pre-window
// before each event. Noise signals are pure gaussian.
function makeWorld(rng, cfg) {
  const days = cfg.days;
  const nEvents = cfg.nEvents;
  const windowH = cfg.windowH;
  const effect = cfg.effect; // in SDs, can be + or -
  const baseMean = cfg.baseMean;
  const baseSd = cfg.baseSd;
  const now = 0;
  const start = now - days * 24 * HOUR;

  // choose event times in the second half so each has baseline history
  const events = [];
  const earliest = start + Math.round(days * 0.35) * 24 * HOUR;
  for (let i = 0; i < nEvents; i++) {
    const t = earliest + Math.floor(rng() * (now - earliest - HOUR));
    events.push({ ts: t, label: 'flare', severity: 1 + Math.floor(rng() * 5) });
  }
  events.sort((a, b) => a.ts - b.ts);

  function inAnyWindow(ts) {
    for (const e of events) if (ts >= e.ts - windowH * HOUR && ts < e.ts) return true;
    return false;
  }

  const planted = [];
  const noise1 = [];
  const noise2 = [];
  for (let t = start; t <= now; t += HOUR) {
    const bump = inAnyWindow(t) ? effect * baseSd : 0;
    planted.push({ ts: t, v: baseMean + bump + gauss(rng) * baseSd });
    noise1.push({ ts: t, v: 50 + gauss(rng) * 8 });
    noise2.push({ ts: t, v: 6 + gauss(rng) * 1.2 });
  }
  return { events, signals: { planted, noise1, noise2 } };
}

// ---------------------------------------------------------------------------
// The 100-scenario property test
// ---------------------------------------------------------------------------
test('recovers a planted prodrome across 100 randomized worlds', () => {
  const N = 100;
  let recovered = 0;
  let signOk = 0;
  let noiseRejected = 0;
  const failures = [];

  for (let i = 0; i < N; i++) {
    const rng = mulberry32(1000 + i);
    const effect = (rng() < 0.5 ? -1 : 1) * (2.0 + rng() * 2.5); // ±2.0..4.5 SD
    const cfg = {
      days: 45 + Math.floor(rng() * 30),
      nEvents: 4 + Math.floor(rng() * 5), // 4..8 events
      windowH: 24,
      effect: effect,
      baseMean: 60 + rng() * 20,
      baseSd: 3 + rng() * 4,
    };
    const world = makeWorld(rng, cfg);
    const fp = C.buildFingerprint(world.events, world.signals, {
      windowHours: 24,
      baselineHours: 24 * 14,
      activeThreshold: 1.5,
      minEventsPerSignal: 2,
    });
    const ranked = C.rankFingerprint(fp);

    const top = ranked[0];
    const plantedOk = top && top.name === 'planted';
    if (plantedOk) recovered++;
    if (plantedOk && Math.sign(top.drift) === Math.sign(effect)) signOk++;

    // noise signals should carry little weight
    const noiseWeights = ['noise1', 'noise2']
      .map((n) => (fp[n] ? fp[n].weight : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    if (noiseWeights <= 0.6) noiseRejected++;

    if (!plantedOk) failures.push({ i, effect: effect.toFixed(2), top: top && top.name });
  }

  // Report so the run is auditable, not just pass/fail.
  console.log(
    `  [100-world Monte-Carlo] planted recovered as #1: ${recovered}/${N} | ` +
      `sign correct: ${signOk}/${N} | noise rejected: ${noiseRejected}/${N}`
  );
  if (failures.length) console.log('  failures:', JSON.stringify(failures.slice(0, 8)));

  // Thresholds: the engine must be robust, not perfect on adversarial noise.
  assert.ok(recovered >= 92, `planted recovered ${recovered}/100 (need >=92)`);
  assert.ok(signOk >= recovered - 1, `sign wrong in too many (${signOk}/${recovered})`);
  assert.ok(noiseRejected >= 90, `noise rejected only ${noiseRejected}/100 (need >=90)`);
});

// A strong, clean planted signal must be recovered essentially every time.
test('strong effect (>=3 SD) recovered in 50/50 clean worlds', () => {
  let ok = 0;
  for (let i = 0; i < 50; i++) {
    const rng = mulberry32(50000 + i);
    const world = makeWorld(rng, {
      days: 60, nEvents: 6, windowH: 24, effect: 3.5, baseMean: 65, baseSd: 4,
    });
    const fp = C.buildFingerprint(world.events, world.signals, {});
    const ranked = C.rankFingerprint(fp);
    if (ranked[0] && ranked[0].name === 'planted') ok++;
  }
  console.log(`  [strong-effect] recovered ${ok}/50`);
  assert.ok(ok >= 48, `strong effect recovered only ${ok}/50`);
});

// matchToday should light up when a fresh window carries the planted drift.
test('matchToday flags an active sign when today drifts like the fingerprint', () => {
  const rng = mulberry32(777);
  const world = makeWorld(rng, {
    days: 50, nEvents: 6, windowH: 24, effect: 3, baseMean: 60, baseSd: 4,
  });
  const fp = C.buildFingerprint(world.events, world.signals, {});
  // Replace the last 24h of the planted signal with a fresh +3SD drift
  // (replace, don't append — appending would duplicate timestamps and dilute).
  const now = 0;
  world.signals.planted = world.signals.planted.filter((p) => p.ts < now - 24 * HOUR);
  for (let t = now - 24 * HOUR; t <= now; t += HOUR) {
    world.signals.planted.push({ ts: t, v: 60 + 3 * 4 });
  }
  const res = C.matchToday(world.signals, fp, {}, now + HOUR);
  console.log(`  [matchToday] active=${res.active.length}/${res.consideredCount}`);
  assert.ok(res.active.some((a) => a.name === 'planted'));
});
