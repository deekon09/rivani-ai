# RIVANI AI V23.4 — Natural Specialist Cleanup

Built from the stable V23.3 Clear Voice recovery baseline.

## Why this patch

Real user test output showed:
- no hard clipping
- strong low-frequency/music reduction
- residual accompaniment still audible in mid-band
- stacked strong enhancement could sound processed / "fata"

## Music Control

The previous speech-safety guard could add full-band raw audio back when
the vocal model became aggressive. That protected speech, but also brought
some music back.

V23.4:
- never uses full-band raw audio as the Music Control safety anchor
- uses a conservative 110 Hz–6.5 kHz speech-band anchor only
- smaller local 20 ms speech-retention blend
- the real UVR vocal model remains the separator

## Background Voices

AUTO mode is now more conservative:
- second-speaker evidence gate remains
- reconstruction gate remains
- continuous secondary beds are treated as music/noise, not a second speaker
- manual Voice A / Voice B still overrides AUTO
- removed the old 4% full-band dry anchor

A missing host helper was also fixed:
- 16 kHz separated speech can now receive a very small, speech-gated
  >7.2 kHz detail restoration at 48 kHz
- it does not restore full-band background audio

## Artifact Guard

When the user selects very strong Clear Voice (for example 85%+) after
Music Control, Background Voices or De-Reverb has already cleaned the
audio, V23.4 prevents a second overly-aggressive pass.

Caps:
- source separation + De-Reverb: up to 76%
- source separation only: up to 80%
- De-Reverb only: up to 80%
- no specialist actually applied: slider value is unchanged

This is pipeline protection, not a lower-quality model.

## Unchanged

- Clear Voice ONNX model
- Clear Voice DSP / chunking / single-thread stable runtime
- De-Reverb worker and math
- Click Repair algorithm
- Fan/Traffic post filters
- microphone workflow
- plan/test-mode behavior
- performance animation pause/resume
