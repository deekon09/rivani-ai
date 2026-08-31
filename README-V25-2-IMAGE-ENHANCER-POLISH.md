# RIVANI AI V25.2 — Image Enhancer Polish

## Fixed
- Choose Image and Adjust & Run Again buttons now use the RIVANI accent treatment instead of the dark/black secondary style.
- Processing overlay uses the existing RIVANI ribbon-R artwork cropped from the official logo asset.
- Before/After labels are visually distinct without tinting the actual image comparison.
- Added Enhance Another Image action that clears the previous result safely and opens a new picker.
- Upload input accepts browser-supported image types rather than only four MIME types; decoder fallback uses the browser <img> pipeline when createImageBitmap cannot decode a supported format.
- Removed the old 20 MB upload rejection. Large files are decoded if the browser can handle them.
- Replaced the fixed 24 MP / 9000px output gate with a device-aware memory budget. Large requests are capped to the highest device-safe effective scale instead of throwing “This image is too large for safe browser enhancement.”

## Performance without model-quality reduction
- Real-ESRGAN model, 128×128 input contract, 8px context and Fidelity Guard remain unchanged.
- Removed unnecessary per-tile WASM sleep/yield (inference already runs in a dedicated Worker).
- Rewrote the hot output reconstruction loop to avoid allocating an RGB array and Array.map for every output pixel. Sampling/2× averaging math is unchanged.
- Final Fidelity Guard composition now reuses the full-size AI canvas instead of allocating a second full-resolution result canvas, reducing peak mobile memory.

## Important
WebGPU is still preferred. If the browser/device cannot run this ONNX graph on WebGPU, it uses the WASM compatibility engine. Faster inference always requires available device compute; V25.2 removes avoidable JavaScript/memory overhead without replacing the AI model with lower-quality filters.
