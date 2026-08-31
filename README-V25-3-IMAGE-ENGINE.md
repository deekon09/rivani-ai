# RIVANI AI V25.3 — Adaptive GPU Engine

## What changed
- WebGPU remains the preferred engine; WASM remains the quality-identical compatibility fallback.
- Requests a high-performance WebGPU adapter preference when supported.
- Tries WebGPU graph capture for the fixed 128×128 Real-ESRGAN tile model, then automatically falls back to standard WebGPU if graph capture is not supported.
- If WebGPU fails during actual inference, the same tile is retried automatically with WASM instead of failing the whole job.
- WASM can use a few threads only when the browser is already cross-origin isolated; RIVANI does not enable isolation or change the Audio Repair deployment headers.
- Reuses the 128×128 float input buffer across tiles and throttles UI progress messages to reduce avoidable CPU/allocation overhead.
- Result report now shows engine class and measured enhancement runtime.
- Processing animation uses a dedicated crop of the official RIVANI ribbon-R asset, fixing the missing/glitched mark.
- Fidelity Guard high-risk path is now a true Safe Pass (0% risky AI blend).

## Unchanged
- Real-ESRGAN x4plus model
- 128×128 model input
- 8 px context / 112 px core tile math
- native 4× inference and 2× box-reduction math
- audio models / Audio Repair / De-Reverb / LUKI
- Cloudflare model route; no Worker update required
