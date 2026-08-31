# RIVANI AI V23.9 — Final Audio Polish

This is the audio freeze / final-touch build.

## Why no more separator tuning

The real user test had loud music playing very close to the phone microphone.
The supplied Adobe reference also retains some background. The current
Voc_FT source-separation path is therefore kept as the accepted baseline
instead of pushing it harder and risking damaged / metallic speech.

V23.9 is based on the actually tested V23.7 Voc_FT build. No additional
untested stem-separation algorithm is introduced.

## Final loudness calibration

Measured supplied references:
- RIVANI tested output: about -16.7 LUFS
- Adobe supplied output: about -21.2 LUFS

Final active-voice targets:
- Studio Finish: -22.2 dB active RMS
- Natural Finish: -22.7 dB active RMS
- peak ceiling: -2.0 dBFS
- automatic upward gain limited to +2.5 dB
- downward correction allowed to -6 dB

This is intentionally not a loudness war / heavy compressor. It simply
prevents the final voice from feeling unnecessarily boosted.

## Audio engines locked

Unchanged from the accepted Voc_FT baseline:
- Clear Voice model / worker / DSP / stable single-thread WASM runtime
- UVR-MDX-NET-Voc_FT Music Control model + V23.7 reference runtime
- De-Reverb worker / math
- Background Voices worker
- Click Repair
- Fan/Traffic single-pass behavior
- Natural Voice Guard
- microphone flow

## Static visual branding

Removed decorative motion from:
- RIVANI AI full logos / wordmarks
- text shimmer / logo shine
- footer / auth / dashboard logo glow
- LUKI ribbon-R floating/glow
- page background breathing/drifting
- ambient blue/violet drift
- grid heartbeat
- homepage hero halo pulse
- decorative repair-button sparkle

Kept:
- actual enhancement / processing animation
- processing wave/orbit/progress feedback
- microphone recording feedback

## Cloudflare

No model Worker update is required.
The existing `/music-vocals-ft.onnx` route remains correct.
