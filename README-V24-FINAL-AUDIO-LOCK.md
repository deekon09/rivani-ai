# RIVANI AI V24 — Final Audio Lock

## Audio quality
V23.9 accepted audio tuning is preserved:
- same Clear Voice model, DSP constants, overlap and strength behavior
- same Voc_FT Music Control model/reconstruction
- same De-Reverb DSP constants/math
- same Background Voices algorithm
- same Fan/Traffic/Click/Studio Finish audio behavior
- same final loudness targets from V23.9

V24 changes scheduling only to reduce sustained CPU pressure.

## CPU Balanced
No quality shortcuts are used.

Changes:
- Clear Voice remains WASM single-thread
- Music Control forced single-thread
- Background Voices forced single-thread
- cooperative event-loop yields during Clear Voice feature/iSTFT work
- cooperative yields during Music STFT/iSTFT
- cooperative yields during De-Reverb analysis/WPE/synthesis
- short rests between long audio chunks

Expected trade-off:
- lower sustained CPU / better UI responsiveness / less thermal pressure
- processing can take somewhat longer
- audio math and model quality are unchanged

## Important cache fix
Older host code still referenced specialist workers with `?v=23.2`.
V24 uses `?v=24.0-final` for Music/Background/De-Reverb/Clear Voice so the
latest approved files are actually loaded after deploy.

## Pro locks
Final Pro-only controls:
- Fan / AC Assist
- Traffic Assist
- Click Repair
- Background Voices
- Music Control
- De-Reverb
- Lossless WAV export

Free:
- AI Clear Voice
- Studio Finish
- MP3 export
- 500 MB/file
- 30 min/file
- 5 completed enhancement jobs/day

Pro:
- 1 GB/file
- 5 h processing/day
- unlimited enhancement job count
- advanced controls above

The current daily-job / Pro-duration counters are still browser-side product
gating. A tamper-resistant paid entitlement requires the future secure plan
backend.

## UI cleanup
Removed customer-facing:
- TEST MODE
- TESTING
- BETA / FREE BETA
- De-Reverb test banner
- specialist test-mode note
- visible "today" usage/debug counters

Audio Repair is presented as a finished flagship tool.

## Cloudflare
No `rivani-models` Worker update is required.
The existing `/music-vocals-ft.onnx` route remains correct.
