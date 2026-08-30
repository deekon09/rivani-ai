# RIVANI AI V21 — De-Reverb Lab + Real Logo Shine

## Logo

V20.1 animated RIVANI text, but the full PNG wordmark did not get a clearly
visible light pass.

V21 wraps every existing `assets/rivani-ai-logo.png` image and applies a moving
silver/cyan/blue highlight using the PNG itself as a CSS mask.

This means the shine is clipped to the actual logo letters/ribbon shape.

## De-Reverb Lab

Public behavior:
- De-Reverb remains a Pro specialist feature.
- It is NOT silently inserted into normal Clear Voice.

Owner/test behavior:
Open:

`audio-repair.html?lab=1`

The De-Reverb specialist card changes to:
- BETA OFF
- BETA ON when clicked

When ON the path is:

Original mono 48 kHz
→ separate De-Reverb worker
→ existing stable RIVANI Clear Voice worker
→ Studio Finish
→ level / peak protection

When OFF the V20/V20.1 stable audio path is unchanged.

## De-Reverb algorithm

The new separate worker implements a conservative single-channel WPE-style
late-reverberation predictor in the STFT domain.

Settings:
- 48 kHz
- FFT 2048
- hop 512
- prediction delay 3 frames
- 8 or 9 long-term prediction taps
- 1–2 iterations depending on strength
- 90 Hz–9 kHz prediction band
- direct-speech magnitude protection
- 6 s processing chunks
- 1 s smooth chunk overlap

It is an independent implementation based on the published WPE formulation.
No NARA-WPE source code is copied into the browser worker.

Reference:
NARA-WPE describes WPE as blind speech dereverberation using long-term linear
prediction and is MIT licensed:
https://github.com/fgnt/nara_wpe

## Why Lab first

Room acoustics vary strongly. A dereverb stage can improve a far-field echo
recording but can damage a clean close-mic recording if applied unnecessarily.

So V21 is intentionally an A/B lab build before the switch becomes a normal
Pro control.

## Stable engine safety

`rivani-ai-worker.js` is the same stable Clear Voice engine.
De-Reverb lives in a new `dereverb-worker.js`.

No paid GPU/server is required for this lab engine.
