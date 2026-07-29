/*
 * Prodrome voice features — extracted ON DEVICE from a ~10s note.
 * The audio itself is never stored or uploaded; only three numbers survive:
 *   - rate:    speech rate proxy (voiced-frame fraction per second)
 *   - pause:   pause ratio (fraction of low-energy frames)
 *   - f0var:   pitch variability (SD of estimated F0 over voiced frames)
 * These are established fatigue / mood / respiratory markers.
 *
 * Browser-only (needs Web Audio). Not part of the headless test suite.
 */
(function (root) {
  'use strict';

  async function record(seconds, onLevel) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const sampleRate = ctx.sampleRate;
    const chunks = [];
    proc.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(data));
      if (onLevel) {
        let s = 0;
        for (let i = 0; i < data.length; i++) s += data[i] * data[i];
        onLevel(Math.sqrt(s / data.length));
      }
    };
    src.connect(proc);
    proc.connect(ctx.destination);

    await new Promise((r) => setTimeout(r, seconds * 1000));

    proc.disconnect();
    src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    await ctx.close();

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const buf = new Float32Array(total);
    let o = 0;
    for (const c of chunks) { buf.set(c, o); o += c.length; }
    return extractFeatures(buf, sampleRate);
  }

  // Frame the signal (~40ms hop), classify voiced/unvoiced by energy, estimate
  // F0 on voiced frames via autocorrelation.
  function extractFeatures(buf, sr) {
    const frame = Math.round(sr * 0.04);
    const nFrames = Math.floor(buf.length / frame);
    if (nFrames < 5) return null;

    const energies = [];
    for (let f = 0; f < nFrames; f++) {
      let s = 0;
      for (let i = 0; i < frame; i++) { const x = buf[f * frame + i]; s += x * x; }
      energies.push(Math.sqrt(s / frame));
    }
    const maxE = Math.max(...energies) || 1e-9;
    const thr = maxE * 0.15; // voiced if >15% of peak energy

    const f0s = [];
    let voiced = 0;
    for (let f = 0; f < nFrames; f++) {
      if (energies[f] < thr) continue;
      voiced++;
      const f0 = autocorrF0(buf, f * frame, frame, sr);
      if (f0 > 60 && f0 < 400) f0s.push(f0);
    }

    const durSec = buf.length / sr;
    const rate = voiced / durSec;            // voiced frames per second
    const pause = 1 - voiced / nFrames;       // fraction of silence
    const f0var = f0s.length > 2 ? stddev(f0s) : 0;

    return {
      rate: round(rate, 3),
      pause: round(pause, 3),
      f0var: round(f0var, 3),
      durSec: round(durSec, 2),
    };
  }

  function autocorrF0(buf, start, len, sr) {
    const minLag = Math.floor(sr / 400);
    const maxLag = Math.floor(sr / 60);
    let bestLag = -1, best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0;
      for (let i = 0; i < len - lag; i++) s += buf[start + i] * buf[start + i + lag];
      if (s > best) { best = s; bestLag = lag; }
    }
    return bestLag > 0 ? sr / bestLag : 0;
  }

  function stddev(a) {
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length);
  }
  function round(x, d) { const f = Math.pow(10, d); return Math.round(x * f) / f; }

  root.ProdromeVoice = { record, extractFeatures };
})(typeof self !== 'undefined' ? self : this);
