/*
 * Prodrome local storage — 100% on-device. No account, no cloud, no network.
 * localStorage holds the small stuff (events, settings, derived signal series);
 * a 30-day rolling window is enforced so raw data auto-expires.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ProdromeStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const KEY = 'prodrome.v1';
  const DAY = 86400 * 1000;
  const RETAIN_DAYS = 30;

  function fresh() {
    return {
      events: [],
      signals: { restingHr: [], sleepDur: [], voiceRate: [], voicePause: [], voiceF0var: [] },
      settings: { retainDays: RETAIN_DAYS, defaultLabel: 'flare' },
      createdAt: Date.now(),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return fresh();
      const d = JSON.parse(raw);
      if (!d.signals) return fresh();
      return d;
    } catch (e) {
      return fresh();
    }
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  // Drop raw samples older than the retention window (events are kept — they
  // are the user's tagged history and are tiny).
  function prune(db) {
    const cutoff = Date.now() - (db.settings.retainDays || RETAIN_DAYS) * DAY;
    for (const name of Object.keys(db.signals)) {
      db.signals[name] = db.signals[name].filter((p) => p.ts >= cutoff);
    }
    return db;
  }

  function addSample(db, signal, value, ts) {
    if (!db.signals[signal]) db.signals[signal] = [];
    db.signals[signal].push({ ts: ts || Date.now(), v: value });
    return db;
  }

  function addEvent(db, label, severity, ts) {
    db.events.push({
      id: 'e' + Date.now().toString(36),
      ts: ts || Date.now(),
      label: label || db.settings.defaultLabel,
      severity: severity || 3,
    });
    db.events.sort((a, b) => a.ts - b.ts);
    return db;
  }

  function removeEvent(db, id) {
    db.events = db.events.filter((e) => e.id !== id);
    return db;
  }

  function exportJson(db) {
    return JSON.stringify(db, null, 2);
  }

  function importJson(text) {
    const d = JSON.parse(text);
    if (!d.signals || !Array.isArray(d.events)) throw new Error('Not a Prodrome backup');
    return d;
  }

  function labels(db) {
    return Array.from(new Set(db.events.map((e) => e.label)));
  }

  return {
    KEY, DAY,
    fresh, load, save, prune,
    addSample, addEvent, removeEvent,
    exportJson, importJson, labels,
  };
});
