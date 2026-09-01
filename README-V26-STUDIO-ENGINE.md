# RIVANI AI V26 — Studio Image Engine

V26 stops treating image enhancement as a single-model strength slider.

## Production paths
- Desktop / strong PC: full flagship Real-ESRGAN x4plus, WebGPU graph-capture fast path with regular-WebGPU retry before WASM.
- Mobile: V25.9 bounded Selective AI completion path retained so mid-range phones do not run hundreds of neural tiles.
- Same post-verification RIVANI Studio Finish math on mobile and PC.

## Smart Scan routing
Smart Scan now classifies a source as portrait, scenery, graphics, or general photo using browser-side signal heuristics. This profile controls finish behavior and mobile tile priority; it is not presented as a neural classifier.

## V26 Studio Finish
Studio Finish runs after Fidelity Guard / Tone Lock instead of before them. This prevents source-protection blending from washing out the visible crispness users expect from an enhancer.

Strong mode intentionally has more visible:
- local detail / edge presence
- vibrance (skin restrained)
- shadow/highlight separation
- dimensional contrast

No face shape, identity or geometry manipulation is performed.

## Comparison
The old drag Before/After slider is restored because identical spatial alignment makes subtle enhancement easier to judge.

## Export
Default export is Smart Photo rather than PNG. WebP uses high visual quality rather than near-lossless 0.99, which avoids giant 50–100 MB photo downloads. PNG remains available when exact pixels are required.

Changing the export selector after a result re-encodes the current verified result without rerunning AI. If a lossy result is later converted to PNG, the UI explicitly does not call that an original pixel master.

## Face specialist decision
V26 does not ship a random community GFPGAN/CodeFormer ONNX. Browser exports found during validation are very large and/or have redistribution/licensing concerns. The architecture leaves a clean specialist slot for a future Pro server/on-device face model after licensing and runtime validation.

## Cloudflare
No model-worker update is required from V25.8/V25.9. Existing routes are sufficient:
- /image-enhancer-x4.onnx
- /image-enhancer-mobile-x4.onnx

## Frozen systems
Audio Repair, LUKI, auth, and existing audio model routes are unchanged.
