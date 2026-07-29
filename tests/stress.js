/*
 * Stress runner — "test it 100 times" with genuine variety.
 * 100 independent rounds. Each round uses a FRESH non-deterministic seed and
 * builds a batch of randomized worlds (planted prodrome buried in noise), then
 * checks that the engine (a) recovers the planted signal as the #1 sign,
 * (b) gets its direction right, and (c) rejects pure-noise decoys.
 *
 * Unlike the fixed-seed unit suite, this varies every run, so 100 rounds here
 * exercise ~thousands of distinct worlds. Run:  node tests/stress.js
 */
const C = require('../www/js/core.js');
const HOUR = C.HOUR;

function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const rnd = (a, b) => a + Math.random() * (b - a);

function makeWorld() {
  const days = Math.round(rnd(40, 80));
  const nEvents = Math.round(rnd(3, 9));
  const windowH = 24;
  const effect = (Math.random() < 0.5 ? -1 : 1) * rnd(1.8, 4.5);
  const baseMean = rnd(50, 90);
  const baseSd = rnd(2.5, 7);
  const now = 0;
  const start = now - days * 24 * HOUR;

  const events = [];
  const earliest = start + Math.round(days * 0.35) * 24 * HOUR;
  for (let i = 0; i < nEvents; i++) {
    events.push({ ts: earliest + Math.floor(Math.random() * (now - earliest - HOUR)), label: 'x', severity: 3 });
  }
  events.sort((a, b) => a.ts - b.ts);
  const inWin = (ts) => events.some((e) => ts >= e.ts - windowH * HOUR && ts < e.ts);

  const planted = [], noise1 = [], noise2 = [], noise3 = [];
  const step = Math.random() < 0.5 ? HOUR : 3 * HOUR; // vary sampling density
  for (let t = start; t <= now; t += step) {
    planted.push({ ts: t, v: baseMean + (inWin(t) ? effect * baseSd : 0) + gauss() * baseSd });
    noise1.push({ ts: t, v: 50 + gauss() * 8 });
    noise2.push({ ts: t, v: 6 + gauss() * 1.2 });
    noise3.push({ ts: t, v: 100 + gauss() * 15 });
  }
  return { events, signals: { planted, noise1, noise2, noise3 }, effect };
}

function runRound(worldsPerRound) {
  let recovered = 0, signOk = 0, noiseRejected = 0;
  for (let i = 0; i < worldsPerRound; i++) {
    const w = makeWorld();
    const fp = C.buildFingerprint(w.events, w.signals, {});
    const ranked = C.rankFingerprint(fp);
    const top = ranked[0];
    const ok = top && top.name === 'planted';
    if (ok) recovered++;
    if (ok && Math.sign(top.drift) === Math.sign(w.effect)) signOk++;
    const maxNoiseW = ['noise1', 'noise2', 'noise3'].reduce((m, n) => Math.max(m, fp[n] ? fp[n].weight : 0), 0);
    if (maxNoiseW <= 0.6) noiseRejected++;
  }
  return { recovered, signOk, noiseRejected, total: worldsPerRound };
}

const ROUNDS = 100;
const WORLDS = 50; // per round => 5000 distinct randomized worlds total
let passRounds = 0;
const agg = { recovered: 0, signOk: 0, noiseRejected: 0, total: 0 };
const failed = [];

console.log(`Running ${ROUNDS} rounds x ${WORLDS} fresh worlds = ${ROUNDS * WORLDS} worlds\n`);
for (let r = 1; r <= ROUNDS; r++) {
  const res = runRound(WORLDS);
  agg.recovered += res.recovered;
  agg.signOk += res.signOk;
  agg.noiseRejected += res.noiseRejected;
  agg.total += res.total;
  // A round "passes" if recovery and noise-rejection stay strong on fresh data.
  const recPct = res.recovered / res.total;
  const noisePct = res.noiseRejected / res.total;
  const ok = recPct >= 0.9 && noisePct >= 0.9 && res.signOk >= res.recovered - 1;
  if (ok) passRounds++;
  else failed.push({ round: r, ...res });
  const bar = ok ? 'ok ' : 'FAIL';
  process.stdout.write(
    `round ${String(r).padStart(3)}: ${bar}  recover ${res.recovered}/${res.total}  sign ${res.signOk}/${res.recovered}  noiseRej ${res.noiseRejected}/${res.total}\n`
  );
}

console.log('\n================ AGGREGATE ================');
console.log(`rounds passed:        ${passRounds}/${ROUNDS}`);
console.log(`worlds recovered #1:  ${agg.recovered}/${agg.total}  (${(100 * agg.recovered / agg.total).toFixed(2)}%)`);
console.log(`direction correct:    ${agg.signOk}/${agg.recovered}  (${(100 * agg.signOk / agg.recovered).toFixed(2)}%)`);
console.log(`noise decoys rejected:${agg.noiseRejected}/${agg.total}  (${(100 * agg.noiseRejected / agg.total).toFixed(2)}%)`);
if (failed.length) console.log('failing rounds:', JSON.stringify(failed.slice(0, 10)));
console.log('===========================================');

process.exit(passRounds >= 98 ? 0 : 1); // allow up to 2 unlucky rounds on random data
