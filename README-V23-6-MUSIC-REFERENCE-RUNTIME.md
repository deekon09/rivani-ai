# RIVANI AI V23.6 — Music Reference Runtime

This patch keeps the same UVR_MDXNET_9482 ONNX model and fixes the browser
pre/post-processing to mirror the official sherpa-onnx UVR runtime much more
closely.

## Root cause

The earlier browser worker used:
- ad-hoc 5.9 s chunks
- 10% waveform overlap/crossfade
- direct center-reflect padding around each model chunk
- a custom iSTFT crop

The official sherpa-onnx runtime instead uses:
- model metadata: 44.1 kHz, n_fft 4096, hop 1024, dim_t 256, dim_f 2048
- 15 s long chunks with 1 s context margins
- internal GEN_SIZE = hop*(dim_t-1) - n_fft
- NFFT/2 zero context around each long chunk before segmenting
- centered reflect STFT
- batch inference over the internal segments
- predicted complex spectrum written directly into the original STFT layout
- bins >= dim_f zeroed
- centered iSTFT plus the same additional NFFT/2 trim used by sherpa-onnx
- margin removal after long-chunk reconstruction

## Product safety

Still preserved:
- catastrophic collapse => SAFE PASS
- weak/phasey vocal stem => SAFE PASS
- SAFE PASS keeps the pre-Music voice path
- valid vocal stem gets restrained level recovery only
- no raw full-band music is mixed back into a successful stem

## Unchanged

- Music model URL/route
- Clear Voice worker/model/DSP/runtime
- De-Reverb worker/math
- Background Voices worker
- Fan/Traffic single-pass behavior
- Natural Voice Guard
- top RIVANI AI header logo remains static

No Cloudflare model-worker update is required.
