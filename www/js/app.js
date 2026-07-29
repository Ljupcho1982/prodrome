/* Prodrome UI glue — vanilla, no framework. */
(function () {
  'use strict';
  const C = window.ProdromeCore;
  const S = window.ProdromeStore;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let db = S.prune(S.load());
  const SIGNAL_LABELS = {
    restingHr: 'Resting HR', sleepDur: 'Sleep', voiceRate: 'Speech rate',
    voicePause: 'Pauses', voiceF0var: 'Pitch var',
  };
  const HIGHER_IS = { restingHr: 'up', sleepDur: 'down', voiceRate: 'down', voicePause: 'up', voiceF0var: 'up' };

  function persist() { S.save(db); }
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
  }
  const fmtDate = (ts) => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtDay = (ts) => new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  // ---- navigation --------------------------------------------------------
  function go(name) {
    $$('.screen').forEach((s) => s.classList.toggle('hidden', s.dataset.screen !== name));
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.go === name));
    if (name === 'rewind') renderEvents();
    if (name === 'fingerprint') renderFingerprint();
    if (name === 'home') renderHeadsUp();
    window.scrollTo(0, 0);
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.go)));

  // ---- home: heads-up ----------------------------------------------------
  function renderHeadsUp() {
    const el = $('#headsup');
    const fp = C.buildFingerprint(db.events, db.signals, {});
    if (!Object.keys(fp).length) {
      el.className = 'card headsup';
      el.innerHTML = '<h3>👋 Getting started</h3><p class="muted small">Tap <b>⚠️ Now</b> whenever an episode starts. After a few tags I can rewind the hours before and learn your personal warning signs. No prediction, no guessing — just one button.</p>';
      return;
    }
    const res = C.matchToday(db.signals, fp, {});
    if (!res.consideredCount) {
      el.className = 'card headsup';
      el.innerHTML = '<h3>🫆 Fingerprint ready</h3><p class="muted small">Add a signal today (voice note or HR/sleep) and I\'ll compare it to your warning signs.</p>';
      return;
    }
    if (res.active.length) {
      el.className = 'card headsup warn';
      const names = res.active.map((a) => SIGNAL_LABELS[a.name] || a.name).join(', ');
      el.innerHTML = `<h3>⚠️ ${res.active.length} of your ${res.consideredCount} warning signs are active</h3>
        <p class="muted small"><b>${names}</b> ${res.active.length > 1 ? 'are' : 'is'} drifting the way ${res.active.length > 1 ? 'they' : 'it'} usually does before an episode. This is a heads-up, not a diagnosis — you know your body.</p>`;
    } else {
      el.className = 'card headsup';
      el.innerHTML = `<h3>✅ Nothing unusual today</h3><p class="muted small">None of your ${res.consideredCount} known warning signs are active right now.</p>`;
    }
  }

  // ---- home: tag now -----------------------------------------------------
  $('#tagNow').addEventListener('click', () => {
    const label = prompt('What is it? (e.g. migraine, flare, crash, panic)', db.settings.defaultLabel || 'flare');
    if (label === null) return;
    const sevRaw = prompt('How bad, 1 (mild) to 5 (severe)?', '3');
    if (sevRaw === null) return;
    const sev = Math.max(1, Math.min(5, parseInt(sevRaw, 10) || 3));
    db.settings.defaultLabel = label.trim().toLowerCase() || 'flare';
    S.addEvent(db, db.settings.defaultLabel, sev);
    persist();
    toast('Tagged. Rewinding…');
    go('rewind');
  });

  // ---- home: voice note --------------------------------------------------
  $('#recBtn').addEventListener('click', async () => {
    const btn = $('#recBtn'); const fill = $('#vmeterFill'); const out = $('#vresult');
    if (!navigator.mediaDevices || !window.ProdromeVoice) { toast('Microphone not available here'); return; }
    btn.disabled = true; btn.textContent = 'Listening… speak';
    out.textContent = '';
    try {
      const feat = await window.ProdromeVoice.record(10, (lvl) => { fill.style.width = Math.min(100, lvl * 400) + '%'; });
      fill.style.width = '0%';
      if (!feat) { out.textContent = 'Too short / silent — try again.'; return; }
      const ts = Date.now();
      S.addSample(db, 'voiceRate', feat.rate, ts);
      S.addSample(db, 'voicePause', feat.pause, ts);
      S.addSample(db, 'voiceF0var', feat.f0var, ts);
      persist();
      out.innerHTML = `Saved ✓ <span class="muted">rate ${feat.rate} · pause ${feat.pause} · pitchVar ${feat.f0var}. Audio discarded.</span>`;
      renderHeadsUp();
    } catch (e) {
      out.textContent = 'Mic permission denied or unavailable.';
    } finally {
      btn.disabled = false; btn.textContent = 'Record 10s';
    }
  });

  // ---- home: manual signals ---------------------------------------------
  $('#saveSignals').addEventListener('click', () => {
    const hr = parseFloat($('#inHr').value);
    const sl = parseFloat($('#inSleep').value);
    let n = 0; const ts = Date.now();
    if (!isNaN(hr)) { S.addSample(db, 'restingHr', hr, ts); n++; }
    if (!isNaN(sl)) { S.addSample(db, 'sleepDur', sl, ts); n++; }
    if (!n) { toast('Enter HR or sleep first'); return; }
    persist(); $('#inHr').value = ''; $('#inSleep').value = '';
    toast('Saved ' + n + ' signal' + (n > 1 ? 's' : '')); renderHeadsUp();
  });

  // ---- rewind ------------------------------------------------------------
  function renderEvents() {
    const list = $('#eventList'); $('#rewindView').innerHTML = '';
    if (!db.events.length) { list.innerHTML = '<div class="empty">No episodes yet. Tap ⚠️ Now on the Home tab when one starts.</div>'; return; }
    list.innerHTML = '';
    db.events.slice().reverse().forEach((e) => {
      const row = document.createElement('div'); row.className = 'evt';
      row.innerHTML = `<div class="dot"></div><div class="meta"><div class="lbl">${e.label}</div><div class="date">${fmtDate(e.ts)}</div></div><div class="sev">${'●'.repeat(e.severity)}</div><button class="del" title="delete">✕</button>`;
      row.addEventListener('click', (ev) => { if (ev.target.classList.contains('del')) return; renderRewind(e); });
      $('.del', row).addEventListener('click', () => { if (confirm('Delete this episode?')) { S.removeEvent(db, e.id); persist(); renderEvents(); } });
      list.appendChild(row);
    });
  }

  function renderRewind(e) {
    const host = $('#rewindView');
    const rows = [];
    for (const name of Object.keys(db.signals)) {
      const d = C.eventDrift(db.signals[name], e.ts, {});
      if (d === null || !isFinite(d)) continue;
      rows.push({ name, drift: d });
    }
    if (!rows.length) { host.innerHTML = `<div class="card"><div class="card-h">⏪ ${e.label} · ${fmtDate(e.ts)}</div><p class="muted small">Not enough signal history around this episode to rewind. Keep logging — future episodes will have more to show.</p></div>`; return; }
    rows.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
    host.innerHTML = `<div class="card"><div class="card-h">⏪ 24h before ${e.label} <span class="hint">${fmtDate(e.ts)}</span></div>
      <p class="muted small">How far each signal was from <em>your</em> normal in the day before. Longer bar = bigger drift.</p>
      ${barsHtml(rows)}</div>`;
  }

  function barsHtml(rows) {
    return '<div class="bars">' + rows.map((r) => {
      const mag = Math.min(1, Math.abs(r.drift) / 4);
      const up = r.drift >= 0;
      const w = (mag * 50).toFixed(1);
      const cls = up ? 'up' : 'down';
      const style = up ? `left:50%;width:${w}%` : `right:50%;width:${w}%`;
      const arrow = up ? '▲' : '▼';
      return `<div class="bar-row"><div class="bar-name">${SIGNAL_LABELS[r.name] || r.name}</div>
        <div class="bar-track"><div class="bar-mid"></div><div class="bar-fill ${cls}" style="${style}"></div></div>
        <div class="bar-val">${arrow}${Math.abs(r.drift).toFixed(1)}σ</div></div>`;
    }).join('') + '</div>';
  }

  // ---- fingerprint -------------------------------------------------------
  let fpLabel = null;
  function renderFingerprint() {
    const labels = S.labels(db);
    const filter = $('#fpFilter');
    if (labels.length > 1) {
      filter.innerHTML = ['<span class="pill' + (fpLabel === null ? ' active' : '') + '" data-l="">All</span>']
        .concat(labels.map((l) => `<span class="pill${fpLabel === l ? ' active' : ''}" data-l="${l}">${l}</span>`)).join('');
      $$('.pill', filter).forEach((p) => p.addEventListener('click', () => { fpLabel = p.dataset.l || null; renderFingerprint(); }));
    } else filter.innerHTML = '';

    const fp = C.buildFingerprint(db.events, db.signals, { label: fpLabel });
    const ranked = C.rankFingerprint(fp);
    const host = $('#fpView');
    if (!ranked.length) {
      host.innerHTML = '<div class="empty">Not enough tagged episodes yet. Tag ⚠️ Now a few times (2+) and your fingerprint appears here.</div>';
      return;
    }
    host.innerHTML = '<div class="card">' + ranked.map((r) => {
      const consistency = Math.round(r.weight * 100);
      const dir = r.drift >= 0 ? 'higher' : 'lower';
      const mag = Math.min(1, Math.abs(r.drift) / 4);
      return `<div style="margin:10px 0">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <b style="text-transform:capitalize">${SIGNAL_LABELS[r.name] || r.name}</b>
          <span class="muted small">${consistency}% of episodes · ${dir}</span>
        </div>
        <div class="bar-track" style="margin-top:6px"><div class="bar-fill ${r.drift >= 0 ? 'up' : 'down'}" style="${r.drift >= 0 ? 'left:0' : 'right:0'};width:${(mag * 100).toFixed(0)}%;border-radius:8px"></div></div>
      </div>`;
    }).join('') + `<p class="muted small" style="margin-top:12px">Based on ${db.events.filter((e)=>!fpLabel||e.label===fpLabel).length} tagged episode(s). The more you tag, the sharper this gets.</p></div>`;
  }

  // ---- doctor report -----------------------------------------------------
  $('#doctorBtn').addEventListener('click', () => {
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to open the report'); return; }
    const fp = C.buildFingerprint(db.events, db.signals, {});
    const ranked = C.rankFingerprint(fp);
    const rowsFp = ranked.map((r) => `<tr><td style="text-transform:capitalize">${SIGNAL_LABELS[r.name] || r.name}</td><td>${r.drift >= 0 ? 'Higher' : 'Lower'} than baseline</td><td>${Math.abs(r.drift).toFixed(1)} SD</td><td>${Math.round(r.weight * 100)}%</td></tr>`).join('');
    const rowsEv = db.events.slice().reverse().map((e) => {
      const parts = Object.keys(db.signals).map((n) => { const d = C.eventDrift(db.signals[n], e.ts, {}); return d !== null && isFinite(d) && Math.abs(d) >= 1 ? `${SIGNAL_LABELS[n] || n} ${d >= 0 ? '↑' : '↓'}${Math.abs(d).toFixed(1)}σ` : null; }).filter(Boolean);
      return `<tr><td>${fmtDay(e.ts)}</td><td style="text-transform:capitalize">${e.label}</td><td>${e.severity}/5</td><td>${parts.join(', ') || '—'}</td></tr>`;
    }).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Prodrome report</title>
      <style>body{font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:760px;margin:24px auto;padding:0 18px}
      h1{font-size:20px;margin:0}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;font-size:12.5px}td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}
      .muted{color:#666}.foot{margin-top:24px;font-size:11px;color:#888}@media print{button{display:none}}</style></head><body>
      <h1>Prodrome — personal episode report</h1>
      <p class="muted">Generated ${new Date().toLocaleString()} · ${db.events.length} episode(s) · on-device data</p>
      <button onclick="print()" style="padding:8px 14px;margin:8px 0">Print / Save as PDF</button>
      <h2>Early-warning fingerprint (24h pre-window vs personal baseline)</h2>
      <table><tr><th>Signal</th><th>Direction</th><th>Typical drift</th><th>Consistency</th></tr>${rowsFp || '<tr><td colspan=4 class="muted">Not enough episodes yet</td></tr>'}</table>
      <h2>Episode log</h2>
      <table><tr><th>Date</th><th>Type</th><th>Severity</th><th>What drifted in the 24h before</th></tr>${rowsEv || '<tr><td colspan=4 class="muted">None</td></tr>'}</table>
      <p class="foot">Prodrome is a self-tracking wellness tool, not a medical device. Drift is measured in robust standard deviations from the individual's own rolling baseline. It describes what changed before self-tagged episodes; it does not diagnose or predict disease.</p>
      </body></html>`);
    w.document.close();
  });

  // ---- data --------------------------------------------------------------
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([S.exportJson(db)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'prodrome-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { try { db = S.prune(S.importJson(rd.result)); persist(); toast('Backup imported'); go('home'); } catch (e) { toast('Not a valid Prodrome backup'); } };
    rd.readAsText(f);
  });
  $('#demoBtn').addEventListener('click', () => {
    if (db.events.length && !confirm('Replace current data with demo data?')) return;
    db = window.ProdromeDemo.build(); persist(); toast('Demo data loaded'); go('rewind');
  });
  $('#wipeBtn').addEventListener('click', () => {
    if (!confirm('Erase ALL Prodrome data on this device? This cannot be undone.')) return;
    localStorage.removeItem(S.KEY); db = S.fresh(); persist(); toast('Everything erased'); go('home');
  });

  // ---- boot --------------------------------------------------------------
  renderHeadsUp();
  window.__prodrome = { get db() { return db; }, C, S }; // for debugging / e2e checks
})();
