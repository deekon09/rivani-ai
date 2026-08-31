# RIVANI AI V23.5 — Safe Natural

This is a product-first quality patch.

## Music Control
- real UVR model remains
- valid vocal stem gets a restrained voice-level recovery
- weak / phasey stem fails a speech-retention + correlation quality gate
- failed quality gate => SAFE PASS
- SAFE PASS restores the pre-Music path instead of outputting bad audio
- no full-band raw music is blended into a successful vocal stem

## Natural Voice Guard
The common "fata / metallic" chain was reduced by preventing stacked
aggressive processing.

Effective Clear Voice limits only when other cleanup is already active:
- Music/Background + De-Reverb: 70%
- Music/Background only: 74%
- De-Reverb + Fan/Traffic: 74%
- De-Reverb only: 78%
- Fan/Traffic only: 80%
- otherwise the user's slider is used unchanged

## Fan / Traffic
Fan and Traffic Assist are no longer applied inside the neural Clear Voice
mask and then again afterward.

They now run once only as the existing restrained post-model cleanup.

## Background Voices
V23.4 AUTO safety behavior remains unchanged.

## De-Reverb
Approved worker / DSP math is unchanged.

## Clear Voice
Model, DSP, stable single-thread full-WASM runtime are unchanged.

## Top logo
The RIVANI AI logo in the top navigation is fully static:
- no shine
- no glow pulse
- no movement

No Cloudflare model-worker update is required.
