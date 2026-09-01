# RIVANI AI V27.1 — Reliable Cutout Hotfix

## Why this patch exists
A high-end desktop test hit `access out of bounds` in the V27 Precision WebGPU path. V27.1 changes the public default to a lightweight-first architecture so background removal completes quickly instead of forcing the large precision graph.

## Engine changes
- `Auto` now uses the small U²-Net-P general-object model first (~4.6 MB model file).
- On desktop, Fast AI attempts WebGPU acceleration first and falls back to dedicated WASM automatically.
- On mobile, Fast AI starts on the compatibility-safe WASM path for stability.
- `Precision` is opt-in only. It now uses a browser-oriented 512×512 BiRefNet-lite fp16 graph rather than the previous 1024 route.
- If Precision fails for any reason, the worker automatically continues with Fast AI. The user is not told to manually rerun another engine.
- Fast and Precision use separate ONNX Runtime module/session paths so a WebGPU failure does not poison the compatibility session.
- Output tensor selection is defensive for U²-Net multi-output graphs.

## Cloudflare model route
A new route is added instead of replacing the cached 1024 route:
- `/background-remover-birefnet-512.onnx`

The existing `/background-remover-birefnet.onnx` route remains untouched so Cloudflare's long-lived cache cannot accidentally serve the old model for the new engine.

Expected health route count after deploying the V27.1 worker: 9.

## UI fixes
- Choose Image uses the standard RIVANI gradient button instead of the dark secondary style.
- Remove Another Image uses the RIVANI gradient style.
- File picker is reset before opening so the same image can be selected again after a completed result.
- Engine copy now explains that Auto is fast-first and Precision is optional/larger.
- Official R ribbon processing animation is unchanged.

## Product behavior preserved
- 9 successful removals/day on Free.
- Failed jobs do not consume quota.
- Signup gate remains.
- Before/After slider, edge controls, Cutout Guard, manual brush, backgrounds, shadow and exports remain.
- Image Enhancer, Audio Repair and LUKI are not changed by this patch.
