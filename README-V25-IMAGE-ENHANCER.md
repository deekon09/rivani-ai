# RIVANI AI V25 — Image Enhancer

## New live tool
`image-enhancer.html`

## Real AI engine
RIVANI uses Qualcomm's BSD-3-Clause Real-ESRGAN x4plus ONNX export:
- 16.7M parameters
- fixed 128×128 RGB input
- native 4× output
- browser ONNX Runtime
- WebGPU first
- stable single-thread WASM fallback
- context-cropped 112px core tiling to reduce tile-border artifacts
- 2× output is produced from the native 4× model output by 2×2 box reduction,
  not by pretending a CSS/canvas sharpen filter is AI

## RIVANI Fidelity Guard
After model inference, the tool compares a sampled downscale of the result
against the source:
- structure similarity
- color drift
- edge-energy amplification

If risk rises, the final AI blend is automatically reduced toward the original.

The source image is always the truth anchor.

## Smart Scan
Before enhancement, RIVANI estimates:
- blur risk
- flat-region noise
- JPEG compression risk
- lighting
- fine-edge sensitivity
- alpha/transparency presence

These are browser-side signal heuristics, not fake model claims.

## Modes
- Natural
- Strong
- Restore
- 2×
- 4×
- Fidelity Guard
- Text & Logo Safe
- Color Lock

## Privacy
The image itself remains in the browser.
Only the ONNX model is fetched from the RIVANI model-delivery Worker.

## Browser safety
Large output jobs are automatically capped to protect memory:
- approx 24 MP output ceiling
- approx 9000 px longest-edge ceiling

The UI reports the actual effective scale if a large 4× request is reduced.

## Cloudflare model Worker update REQUIRED
Deploy:
`cloudflare-rivani-models-v25-image-worker.js`

It adds only:
`/image-enhancer-x4.onnx`

Existing audio routes remain unchanged:
- `/mossformer2_48k.onnx`
- `/background-voices.onnx`
- `/music-vocals.onnx`
- `/music-vocals-ft.onnx`

## Updated navigation/status
- homepage Image Enhancer card -> Live
- homepage spotlight -> Live
- Features -> Live
- Dashboard quick tool -> opens live Image Enhancer
- Image Enhancer guide -> live implementation details
- LUKI local fallback -> live tool status

## Plans
Image plan gating is intentionally not finalized in V25 because final cross-tool
Free/Pro packaging will be decided after the remaining tools are implemented.


## V25.8 Mobile Hybrid route
`/image-enhancer-mobile-x4.onnx` is used by the adaptive mobile engine. See `README-V25-8-MOBILE-HYBRID.md`.
