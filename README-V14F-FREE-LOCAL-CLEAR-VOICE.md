# RIVANI AI V14F — FREE LOCAL CLEAR VOICE

This is the no-paid-GPU version.

## Cost architecture

Audio processing happens on the visitor's own device.

RIVANI does NOT need:
- Modal
- a paid GPU server
- a new audio API Worker
- per-minute GPU billing

The site downloads the DeepFilterNet3 WebAssembly/model assets on first use,
then processes the uploaded audio locally.

## Main processing path

Audio
-> resample to 48 kHz
-> DeepFilterNet3 WASM
-> speech-aware Artifact Guard
-> optional Natural / Broadcast / Studio voice finish
-> LUFS-style loudness balancing
-> peak guard
-> WAV export

RNNoise is NOT stacked with DeepFilterNet3 in this build.

## Why

The prior tests showed metallic / "jhil-jhil" artifacts when multiple denoisers,
restoration passes and aggressive settings were combined.

V14F uses one main neural denoiser and makes the slider change DeepFilterNet3's
real attenuation limit:

- 25% ≈ 13 dB max reduction
- 80% ≈ 31 dB max reduction
- 100% ≈ 38 dB max reduction

The build deliberately avoids 50–100 dB extreme attenuation values.

## Natural / Broadcast / Studio

These are finishing styles only.

They do NOT change the denoising model.

Natural:
- minimal EQ/compression
- target ~ -18 LUFS

Broadcast:
- mild mud reduction + presence
- gentle compression
- target ~ -16.5 LUFS

Studio:
- slightly stronger presence/dynamics
- target ~ -16 LUFS

## Important

The first repair needs internet so the browser can download the DeepFilterNet3
WASM/model assets from its CDN. That is model delivery, not RIVANI GPU compute.

If the model fails to load, V14F shows an error and DOES NOT silently generate
a lower-quality fake result.

## Device considerations

Because processing is local:
- faster laptops/desktops will process faster
- phones may take longer
- long recordings use the user's RAM/CPU
- current safety limits are 60 minutes / 250 MB per file

There is no daily processing quota required for GPU cost in this build.

## Deploy

Replace/upload all files from this package to the GitHub repository root.
No Modal setup.
No new Cloudflare audio Worker.
No new secrets.

Then Cloudflare deploy -> Ctrl+F5 -> test `/audio-repair.html`.
