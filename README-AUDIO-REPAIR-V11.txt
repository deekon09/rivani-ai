RIVANI AI V11 — RNNoise Neural Audio Repair

ACTUAL ENGINE UPGRADE:
- RNNoise WebAssembly neural noise suppression is now used in the browser.
- RNNoise processing runs inside a Web Worker so the main UI remains responsive.
- Input is resampled to 48 kHz for RNNoise, processed in 480-sample frames,
  then optionally resampled back to the source sample rate.
- Voice Lock now affects the neural wet/dry mix using RNNoise VAD confidence:
  high-confidence speech frames are processed less aggressively.
- RNNoise is followed by:
  * smooth adaptive room-floor reduction
  * rumble high-pass filter
  * 50/60/100/120 Hz hum notches
  * voice-presence EQ
  * gentle compression
  * final normalization / soft limiting
- Natural / Clean / Studio and AI Noise Removal strength now affect the neural pass.
- Neural processing falls back to local DSP if RNNoise cannot load.
- Free Beta file limit: 45 minutes per file.
- Processing animation reports neural progress.

DEPENDENCY:
@shiguredo/rnnoise-wasm 2025.1.5
Apache-2.0 package. RNNoise itself has its upstream license.
The Worker imports the package from UNPKG on first use, then the browser/CDN can cache it.

IMPORTANT QUALITY NOTE:
RNNoise is designed for speech noise suppression. It will not perfectly remove
heavy room echo, music, or another person speaking over the target speaker.
Those need separate de-reverb/source-separation models.

DEPLOY:
1. Upload/replace all V11 website files in the GitHub repo root.
2. Ensure rnnoise-worker.js is uploaded next to audio-repair.js.
3. Let Cloudflare redeploy.
4. Hard refresh (Ctrl+F5).
5. Test /audio-repair.html with a fan/AC/hiss noisy voice sample.
