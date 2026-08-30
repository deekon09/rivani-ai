RIVANI AI V13 — Smooth Voice Hybrid

Built after listening to the Natural / Clean / Studio test outputs.

WHY V13:
The previous aggressive presets could leave a metallic / shimmer ("jhil-jhil")
texture. V13 changes the architecture instead of simply turning denoise up.

PRESET ENGINE PATHS

Natural:
  RNNoise Light
  -> speech-aware Artifact Guard
  -> gentle hum/rumble and dynamics
  -> ~ -18 LUFS-style finish

Clean:
  Silero VAD speech map (fallback: local energy VAD)
  -> DeepFilterNet3 full-band neural denoise
  -> Artifact Guard
  -> de-plosive + de-esser restoration
  -> gentle tone/dynamics
  -> ~ -16.8 LUFS-style finish

Studio:
  Silero VAD
  -> DeepFilterNet3 stronger full-band denoise
  -> Artifact Guard
  -> optional de-clip when clipping is detected
  -> de-plosive
  -> conservative de-click
  -> de-esser
  -> moderate single-channel de-reverb
  -> light breath control
  -> voice tone/dynamics
  -> ~ -16 LUFS-style finish

SMOOTHNESS / ANTI-ARTIFACT WORK
- Strong RNNoise + DeepFilterNet are NOT stacked at maximum.
- Artifact Guard compares repaired audio to the dry signal.
- Speech frames automatically receive more dry voice if neural change is too large.
- The high-frequency neural residual is smoothed to reduce metallic shimmer.
- The old aggressive gate was reduced substantially.
- Studio high-shelf boost was reduced.
- Final loudness uses a K-weighted LUFS-style measurement instead of simple peak normalization.
- A 4x intersample peak guard reduces clipping risk.

ENGINE FALLBACKS
- If Silero VAD cannot load: local speech map is used.
- If DeepFilterNet3 cannot load: Clean/Studio automatically fall back to RNNoise.
- If optional restoration DSP cannot load: neural cleanup + built-in DSP still completes.
- Heavy work runs in Web Workers where possible.

REMOTE OPEN-SOURCE DEPENDENCIES
- @shiguredo/rnnoise-wasm (existing RNNoise path)
- @ricky0123/vad-web 0.0.30 (Silero VAD)
- deepfilter-standalone 1.0.2 (DeepFilterNet3 direct WASM processing)
- @audio/denoise 0.3.7 (de-esser/de-reverb/declick/deplosive/etc.)

The browser may download/cache additional model/WASM assets on the first Clean/Studio run.

STILL NOT SOLVED PERFECTLY
- Another person speaking on top of the target speaker
- Background music mixed underneath speech
Those require source separation / target-speaker separation in a future phase.

DEPLOY
1. Upload/replace all files in the GitHub repo root.
2. IMPORTANT new file: hybrid-audio-worker.js
3. Keep rnnoise-worker.js too.
4. Let Cloudflare redeploy.
5. Hard refresh (Ctrl+F5).
6. Test the exact SAME original recording in Natural, Clean and Studio.
