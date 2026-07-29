# Prodrome — a flight recorder for your body 🕳️⏪

**One line:** A 100% on-device app that silently keeps a rolling buffer of your cheap everyday signals, and the instant you tap *"something's wrong right now,"* it **rewinds** and shows what quietly changed in the hours before — learning *your* personal early-warning fingerprint over time.

Think **dashcam, not diary.** You never log ahead of time or guess your triggers. You hit one button at your worst moment, and the app does the archaeology.

---

## The problem (validated, July 2026)

Every symptom app works **forwards**: it nags you to log data *today* so that *maybe someday* a pattern appears. But the moment that actually matters — a migraine, an IBD/RA/MS flare, a POTS crash, a panic attack, an autoimmune episode, a seizure aura — the warning signs already happened **6–48 hours earlier**, and by the time you feel it, that data is gone and you're in no state to log anything.

The signal is real and measured:
- Behavioral anomalies are **~2.1–2.8× more frequent in the month before a relapse** than in stable intervals; one study saw a **median 108% increase** in anomalies near relapse. (digital-phenotyping research, PMC10753422)
- Vocal features flag moderate-to-severe depression from ~25s of speech >70% of the time; voice also tracks respiratory and fatigue states. (Psychiatry.org / BIS Research, 2025)

**Nobody has shipped the consumer product**, because everyone asks the user to *predict*. Prediction is the wrong verb. **Tagging after the fact is the right one.**

## Why this is genuinely new

- **It reverses the interaction.** Migraine/flare apps make you log forwards and predict. Prodrome lets you tag *backwards* — retrospective, one-tap — and it does the correlation.
- **It's condition-agnostic.** It doesn't need your diagnosis. It learns *your* n-of-1 baseline and *your* prodrome fingerprint. The same engine serves a migraineur, a Crohn's patient, and someone with panic disorder — the exact population that falls *between* the disease-specific silos.
- **It's the missing consumer version** of digital-phenotyping research that today only exists in clinical trials — and it runs **fully on-device**, which the cloud biomarker products cannot claim. Privacy is both the ethic and the wedge.

---

## How it works (the four mechanics)

### 1. The rolling buffer (the "black box")
Passively, on-device, sample cheap signals the phone already has. Keep a rolling **30-day window**; raw data older than that auto-deletes.

| Signal | Source | Cost to user | Prodrome value |
|---|---|---|---|
| Resting HR / HRV | paired watch (optional) | zero (passive) | autonomic drift before flares/crashes |
| Sleep timing & duration | Health Connect / HealthKit | zero | fragmentation precedes migraine, mood episodes |
| Step cadence / activity | phone pedometer | zero | withdrawal/slowdown is an early sign |
| Screen-use rhythm | app usage stats | zero | disrupted rhythm = anomaly |
| Typing speed / error rate | in-app keyboard only | zero | psychomotor slowing |
| **10-sec daily voice note** | mic (opt-in) | ~10s/day | **richest cheap signal**: pitch variance, speech rate, pause length → fatigue/mood/respiratory |

The daily voice note doubles as a **micro-journal** — the one active habit people actually keep — and its acoustic features are extracted on-device; the audio itself can be discarded immediately if the user prefers.

### 2. The one button
When an episode starts, tap **"⚠️ Now."** Optionally name it ("migraine", "flare", "crash", "panic") and rate severity 1–5. That is the entire logging burden.

### 3. The rewind
It replays the **6–48h before the tag** and surfaces what deviated from *your* normal:
> *"Your resting HR was up 9 bpm and you spoke 20% slower for two days before your last three migraines."*

### 4. The fingerprint
After a handful of tagged events it builds your personal prodrome signature and gives an **honest, evidence-first** heads-up:
> *"2 of your 3 early-warning signs are showing today."*

No fake precision, no black-box "risk score." It shows the evidence, and lets *you* decide.

### The doctor page
Export a clean one-pager: episodes + what preceded each. This is the artifact a patient can never produce in a 12-minute appointment — and where the real-world value lands.

---

## On-device method (no cloud, no ML server)

Deliberately simple and explainable — this is a wellness tool, not a diagnostic black box.

1. **Per-signal baseline.** For each signal, maintain a rolling robust baseline (median + MAD) over a trailing window, per hour-of-day where circadian (HR, activity, sleep).
2. **Drift score.** Each signal's current value → a robust z-like score: `(x − median) / (1.4826·MAD)`. Clamp, sign-orient. This is the "how far from *my* normal" number.
3. **Event alignment.** On a `⚠️ Now` tag, extract the 6/12/24/48h pre-window drift vectors and store them against the event.
4. **Fingerprint = mean pre-window drift across a user's events**, with a per-signal consistency weight (a signal that spikes before *every* episode outweighs a noisy one). Pure arithmetic — runs on the user's i5 or any phone.
5. **Live heads-up.** Compare today's drift vector to the fingerprint (cosine / weighted overlap). Surface *which* signs are active, never a single opaque score.
6. **Voice features on-device.** Extract pitch (autocorrelation F0), speech rate (energy-based syllable proxy), pause ratio, jitter/shimmer via a small WASM DSP routine (Meyda-class) — no model download, no upload.

Optional later: swap step 5 for a tiny per-user autoencoder (reconstruction error = anomaly), matching the research method — but only once the arithmetic version proves the concept.

---

## MVP scope (buildable in ~2 weeks, PWA + Capacitor)

Ship the loop, not the sensors. **v0.1 needs only two signals** to be useful:

- ✅ **Daily 10-sec voice note** → on-device pitch + speech-rate + pause features (Web Audio API + Meyda/WASM)
- ✅ **Resting HR + sleep** via Health Connect (Android) / HealthKit (iOS) if a watch is present; gracefully degrade if not
- ✅ **⚠️ Now** one-tap event tag with name + severity
- ✅ **Rewind view** — pre-window drift chart per event
- ✅ **Fingerprint view** — "your early-warning signs" once ≥3 events exist
- ✅ **Doctor one-pager** export (PDF/print)
- ✅ 100% offline, no account, local storage only, JSON export/import (matches Expira/My-Diary pattern)

**Cut from MVP:** typing/screen-usage passive sensing, autoencoder model, live push heads-up. Add after the core loop earns trust.

## Roadmap

- **v0.1** voice + HR/sleep, tag → rewind → fingerprint, doctor export
- **v0.2** add passive activity/screen rhythm; live "signs active today" card
- **v0.3** per-user autoencoder option; multiple episode types side-by-side
- **v0.4** Capacitor Android APK + iOS; optional local notifications for the daily voice prompt
- **v1.0** clinician-shareable report format; anonymized opt-in research export

---

## Pressure-test (honest)

**Competitors / prior art**
- *Bearable, Migraine Buddy, Guava, Visible* — all **forward-logging** diaries/predictors. None do retrospective tag → auto-rewind against a personal baseline. The mechanic is open.
- *Digital phenotyping (Mindstrong-era, academic)* — same underlying science, but cloud, clinical, disease-specific, not shipping to consumers. Prodrome's edge = on-device + condition-agnostic + one-button UX.
- Risk: a big wearable vendor (Apple/Oura/Whoop) bolts "flag an event → see what changed" onto their app. Mitigation: cross-platform + voice + privacy-first + doctor-export focus they won't prioritize.

**Clinical validity**
- The pre-event anomaly signal is published, but n-of-1 personalization means **cold-start is real**: needs ~3–6 tagged events before the fingerprint is meaningful. Design must be honest and useful *before* that (the rewind view alone has value from event #1).
- Confounds (a bad night's sleep from a noisy neighbor, not a prodrome) will happen. Never claim causation; show correlation + let the user annotate/dismiss.

**Regulatory line (important)**
- Stay firmly in **wellness / self-knowledge**, not **diagnosis or prediction of a specific disease**. "Here's what changed before *the events you tagged*" is observation. "You will have a migraine" is a medical-device claim (FDA SaMD / EU MDR). Keep all copy in the descriptive past/present tense. This keeps it shippable solo without clearance.
- On-device-only processing also sidesteps most GDPR/HIPAA data-controller burden — a real structural advantage.

**Adherence**
- The daily voice note is the make-or-break habit. It must feel like a 10-second journal the user *wants* (playback, streak, "what you sounded like"), not a medical chore.

---

## Project layout (planned, matches your other ventures)
- `www/` — vanilla HTML/CSS/JS PWA, zero build step
- `android/` — Capacitor project (added at v0.4)
- `assets/` — icons & splash
- storage: `localStorage` for events/baselines, IndexedDB for voice-feature series

## Tech
Vanilla HTML/CSS/JS + Web Audio API for capture, Meyda (or hand-rolled WASM DSP) for voice features, Health Connect / HealthKit bridge via a Capacitor plugin, Chart rendering with a tiny canvas routine. Zero server. Zero account. Nothing leaves the device.

## Data model (draft)
```json
{
  "events": [
    { "id": "e1", "ts": 1753. , "label": "migraine", "severity": 4 }
  ],
  "signals": {
    "restingHr": [ { "ts": 0, "v": 62 } ],
    "sleepDur":  [ { "ts": 0, "v": 6.1 } ],
    "voice":     [ { "ts": 0, "f0var": 0.18, "rate": 3.9, "pauseRatio": 0.22 } ]
  },
  "fingerprint": {
    "migraine": { "restingHr": { "drift": 1.8, "weight": 0.9 },
                  "voiceRate": { "drift": -1.2, "weight": 0.7 } }
  }
}
```

## The pitch in one breath
> Other apps ask you to predict your body. Prodrome just asks you to press one button when you feel bad — then it rewinds the tape and shows you the warning you couldn't see. Entirely on your phone. Nothing leaves.

---

## STATUS: v1.0 shipped ✅ (built & tested 2026-07-29)

The MVP is built and packaged. `Prodrome-debug.apk` (4.4 MB) is in this folder.

### What's implemented
- ⚠️ **One-tap episode tag** (label + severity)
- 🎙️ **10-sec voice note** → on-device pitch / speech-rate / pause extraction (Web Audio, audio discarded immediately)
- ➕ Manual/watch signal entry (resting HR, sleep)
- ⏪ **Rewind view** — 24h pre-window drift bars per episode, sorted by magnitude
- 🫆 **Fingerprint view** — per-signal drift + consistency across episodes, with per-label filter
- 🩺 **Doctor one-pager** (printable / Save-as-PDF)
- 💾 JSON export/import, demo-data loader, full wipe
- 100% offline PWA + installable Android APK; dark theme

### Test evidence ("tested 100×", honestly)
`npm test` runs a property-based suite (`tests/core.test.js`):
- **100 randomized "worlds"** each plant an early-warning signal in noise → engine recovers it as the #1 sign **100/100**, correct direction **100/100**, rejects pure-noise decoys **100/100**.
- **50 clean strong-effect worlds** recovered **50/50**.
- Unit tests for robust stats (MAD baseline, outlier resistance, divide-by-zero guard) + a regression test for the `eventDrift` defaulting bug found during browser testing.
- Live browser verification: demo data → rewind bars ▼2.8σ / ▼2.5σ / ▲2.4σ / ▲2.2σ and fingerprint (Speech rate 100%, Sleep 100%, HR 100%, Pauses 80%, decoy 0%).

```bash
npm test           # run the whole suite
```

## Run locally (web)
```bash
cd prodrome/www
python -m http.server 8731
# open http://localhost:8731
```

## Android APK
Already built: **`Prodrome-debug.apk`** — copy to the phone, allow "install unknown apps", tap to install.

Rebuild after changing anything in `www/`:
```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd prodrome
npx cap sync android
cd android
.\gradlew.bat assembleDebug
# output: android\app\build\outputs\apk\debug\app-debug.apk
```
(or just run `./build-apk.ps1` from the `prodrome/` folder.)

## Make it public (signed release for distribution)
The debug APK installs fine for testing but is debug-signed. For public download:
1. **Signed APK / AAB** — create a keystore once (`keytool -genkey -v -keystore prodrome.keystore -alias prodrome -keyalg RSA -keysize 2048 -validity 10000`), wire it into `android/app/build.gradle` `signingConfigs`, then `./gradlew.bat assembleRelease` (APK) or `bundleRelease` (Play Store AAB).
2. **Where to host the download (pick one):**
   - **GitHub Releases** — free, trusted, direct `.apk` link. Best for a "download the APK" button.
   - **itch.io** — friendly public page, handles the "unknown sources" explanation for users.
   - **Google Play** — widest reach; needs the $25 dev account + signed AAB + a privacy policy (easy here: "all data stays on device, nothing is collected").
   - **Any static host** (Netlify/Cloudflare Pages) — also serves the PWA itself so people can "Add to Home screen" with no APK at all.

> Note: publishing to a public host / app store is an account action that must be done by the owner. The APK and the signing steps are ready; say the word and I'll wire up the release config + a GitHub Releases page.

## Tech
Vanilla HTML/CSS/JS — zero runtime dependencies, zero build step. `core.js` is a pure UMD module shared by the app and the Node test runner. `localStorage` for state, Web Audio for voice features, service worker for offline, Capacitor for the Android wrapper.

## Project layout
- `www/` — the PWA (index.html, css/, js/core.js·storage.js·voice.js·demo.js·app.js, sw.js, manifest, icons/)
- `tests/core.test.js` — property-based test suite (`npm test`)
- `assets/make_icons.py` — stdlib PNG icon generator
- `android/` — Capacitor Android project
- `Prodrome-debug.apk` — installable debug build
