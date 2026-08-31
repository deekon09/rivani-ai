# RIVANI AI V23.8 — Music Stem Purifier

Built on the V23.7 Voc_FT model + reference-style UVR runtime.

## Why

A/B against the user's Adobe reference showed:
- core speech region is already fairly similar
- RIVANI still carries noticeably more residual energy above ~3 kHz
- the largest gap is roughly 6–18 kHz, matching the audible background /
  separation texture reported by the user

## What changed

The model itself is unchanged.

After the Voc_FT model predicts the complex vocal spectrum, V23.8 compares:
- original mixture complex STFT
- predicted vocal complex STFT
- estimated residual = mixture - vocal

A smooth Wiener-style ratio mask then suppresses bins where accompaniment
still dominates.

There is NO hard spectral gate and NO raw/full-band audio mix-back.

Frequency-aware protection:
- <250 Hz: strongest voice/fundamental protection
- 250 Hz–3 kHz: conservative
- 3–8 kHz: stronger residual cleanup
- >8 kHz: strongest residual cleanup
- model-confident vocal bins remain nearly untouched

The 100% Aggressive control increases this soft purification rather than
forcing an EQ or destructive hard gate.

## Product safeguards preserved

- weak / phasey stem => SAFE PASS
- catastrophic stem => SAFE PASS
- valid stem level recovery
- Natural Voice Guard
- Fan/Traffic single-pass cleanup
- Click Repair unchanged

## Unchanged

- UVR-MDX-NET-Voc_FT model
- Cloudflare model routes
- Clear Voice worker/model/runtime
- De-Reverb worker/math
- Background Voices worker
- top RIVANI AI header logo remains static

No Cloudflare Worker update is required for V23.8.
