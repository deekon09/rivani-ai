# RIVANI AI V23.7 — VocFT Music Control

## Why

Real user testing with Music Control at 100% Aggressive still left audible
background music with UVR_MDXNET_9482.

V23.7 stops pushing the smaller model harder and switches Music Control to
the vocal fine-tuned UVR-MDX-NET-Voc_FT model.

## Model

New browser route:
`/music-vocals-ft.onnx`

Upstream:
`UVR-MDX-NET-Voc_FT.onnx` from the official sherpa-onnx source-separation
release assets.

Model-specific host geometry:
- sample rate: 44100
- FFT: 6144
- hop: 1024
- dim_t: 256
- dim_f: 3072
- channels: 4 complex planes
- target: vocals
- internal GEN_SIZE: 254976

The V23.6 reference-style long-chunk/STFT/iSTFT reconstruction is preserved.

## Safety

Preserved:
- catastrophic output => SAFE PASS
- weak / phasey vocal stem => SAFE PASS
- valid stem receives restrained level recovery
- no full-band raw music is mixed back into a valid vocal stem
- Natural Voice Guard
- Fan/Traffic single-pass cleanup
- stable Clear Voice full-WASM runtime

## Stable features untouched

- Clear Voice worker is byte-identical to V23.6
- De-Reverb worker is byte-identical to V23.6
- Background Voices worker is byte-identical to V23.6
- Click Repair unchanged
- top navigation RIVANI AI logo remains static

## Cloudflare model Worker

Deploy `cloudflare-rivani-models-v23-7-worker.js`.

It only ADDS:
`/music-vocals-ft.onnx`

It does NOT change:
- `/mossformer2_48k.onnx`
- `/background-voices.onnx`
- `/music-vocals.onnx`

This keeps the approved Clear Voice route isolated from the Music upgrade.
