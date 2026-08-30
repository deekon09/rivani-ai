# RIVANI AI V16 — Clear Voice X

## Goal

The goal is NOT to copy Adobe Podcast Enhance Speech.

The engineering target is to beat it on RIVANI's real-world test set for:
1. natural voice quality
2. residual background noise
3. speech intelligibility
4. metallic / "jhil-jhil" artifacts
5. "fate-fate" / phasey artifacts
6. consistency when background noise changes

Do not advertise "better than Adobe" until blind A/B testing proves it.

## V16 engine

Primary:
MossFormer2_SE_48K

ONNX:
TigreGotico/audiosronnx-mossformer2
Pinned revision:
0d91401f480ab971bb26daa108771c5fc9c8cfeb

License:
Apache-2.0

Model:
~229 MB, automatically loaded by the browser on first use and stored in browser CacheStorage.
The user does NOT manually install/download a file.

Runtime:
ONNX Runtime Web 1.29.0

Execution:
- WebGPU first on supported Chrome/Edge hardware
- WebAssembly fallback
- no RIVANI server GPU bill

## Important processing change

V15 mixed a neural waveform with the dry waveform.
Even with delay alignment, that was the wrong architecture to keep patching.

V16 NEVER mixes a delayed denoised waveform with the original waveform.

MossFormer2 predicts a spectral mask.
RIVANI changes enhancement strength inside that mask path and reconstructs one waveform.

This removes an entire class of comb-filter / flanging / phasey failures.

## Front-end reproduced for the model

- sample rate: 48,000 Hz
- waveform feature scale: x32768
- analysis window: 1,920 samples / 40 ms
- hop: 384 samples / 8 ms
- 60 Kaldi mel bands
- first delta
- second delta
- ONNX input: [1, T, 180]
- ONNX output mask: [1, T, 961]
- symmetric Hamming
- non-centred 1,920-point STFT
- 4 second model windows
- 3 second stride
- 0.5 second transient-edge discard

The implementation follows the public audiosronnx adapter design for MossFormer2.

## UI philosophy

One-click first:
Upload -> Scan -> Enhancement Strength -> Enhance Audio -> Compare -> Download

Natural / Clean / Studio denoise modes are gone.
Voice Finish selectors are gone.

The user should not need to understand denoising engines.

## What V16 does NOT claim yet

MossFormer2 is a speech denoiser/enhancer. It is not by itself a complete replacement
for Adobe's newer source separation stack.

Still needed later for the full product:
- speech / background / music separation
- overlapping-speaker separation
- target-speaker extraction
- detected de-reverb stage
- optional restoration for distant / bandwidth-limited voice

These should be separate specialist engines, not blindly stacked on every clip.

## Deploy

No Modal.
No new GPU API.
No secrets.

Upload/replace the V16 website files in the GitHub repository root.
Cloudflare deploy.
Ctrl+F5.
Open /audio-repair.html.

Test the SAME original noisy clip first at the default 85%.

## First-run behavior

The browser automatically downloads the ~229 MB AI model.
This is automatic model loading, not a manual user download.

The model is cached where CacheStorage is available.

If model loading or inference fails, V16 returns an error.
It does NOT silently fall back to RNNoise or DeepFilter and pretend the same engine ran.

## Browser recommendation during Beta

Best first target:
Current Chrome / Edge on desktop with WebGPU.

WASM remains a fallback, but a 229 MB transformer-style enhancement model may be
too slow or memory-heavy on weak phones.

Production will need a lighter mobile path after quality is proven.
