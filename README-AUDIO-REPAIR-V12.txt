RIVANI AI V12 — Audio Repair tuning based on a real before/after user sample

What was wrong in V11:
- RNNoise was working strongly in quiet gaps, but Voice Lock kept the RNNoise
  wet mix too low during speech for ALL presets.
- Natural / Clean / Studio therefore sounded too similar.
- Peak normalization made the enhanced sample about ~4 dB louder, making the
  change feel more like volume boosting than a clean repair.

V12 fixes:
- Natural default: 45% strength, conservative speech denoise.
- Clean default: 78% strength, much stronger suppression under speech.
- Studio default: 100% strength, strongest suppression + more presence/dynamics.
- Voice Lock is now preset-aware instead of flattening all three modes.
- Voice-aware RMS leveling replaces aggressive peak normalization.
- Maximum automatic gain is limited; noise floor should not be boosted back up.
- Smoother start/end fades and gentler adaptive gate envelope.
- Result label shows the actual neural cleanup percentage.

Deployment:
Upload/replace all V12 website files, including rnnoise-worker.js.
Hard refresh after deploy (Ctrl+F5).
Test the SAME noisy sample in Natural, Clean and Studio.
