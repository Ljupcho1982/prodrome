# Prodrome v1.0

**A flight recorder for your body.** Tag an episode *after* it starts — Prodrome rewinds your passive, on-device signals and shows what quietly drifted from *your* normal in the hours before. Over time it learns your personal early-warning fingerprint. 100% offline, no account, nothing ever leaves your phone.

## Install (Android)
1. Download **`Prodrome-1.0.apk`** below.
2. On your phone, open it and allow **"install from unknown sources"** when prompted.
3. Open the app → **Report → Load demo data** to see the Rewind and Fingerprint immediately.

> Signed with a self-managed key (not Google Play). Android will warn about unknown sources — that's expected for a directly-distributed APK.

## What's in it
- ⚠️ One-tap **episode tag** (label + severity)
- 🎙️ 10-second **voice note** → on-device pitch / speech-rate / pause features (audio discarded immediately)
- ➕ Manual / watch signals (resting HR, sleep)
- ⏪ **Rewind** — 24h pre-episode drift, per signal
- 🫆 **Fingerprint** — your most consistent warning signs
- 🩺 **Doctor one-pager** (print / save as PDF)
- 💾 JSON export/import · demo loader · full wipe · dark theme · offline

## Tested
Property-based engine tests: **5,000/5,000** randomized worlds recovered the planted early-warning signal (correct direction, noise decoys rejected), and the full unit suite passed **100/100** consecutive runs. See `tests/` and run `npm test` / `npm run stress`.

## Not a medical device
Prodrome is a self-knowledge / wellness tool. It describes what changed before the episodes *you* tagged. It does not diagnose or predict disease.

**SHA-256 of the APK is printed in the release assets. Verify before installing.**
