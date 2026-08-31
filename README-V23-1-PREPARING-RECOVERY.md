# RIVANI AI V23.1 — PREPARING Recovery

Root cause:
- V22.1/V23 tried WebGPU specialist session creation as soon as the user toggled Background Voices or Music Control ON.
- On some GPU/driver combinations, WebGPU graph/session compilation can remain pending and never emit ready/error.
- The UI then remains PREPARING and Enhance waits on the same unresolved session promise.

Fix:
- Specialist toggle ON is instant; no model/session warmup on click.
- Models prepare only after Enhance is pressed.
- Background Voices and Music Control use stable standard WASM for this recovery build.
- WASM multi-threading remains available when cross-origin isolation is active.
- Worker error events and preparation timeouts reset the worker cleanly.
- If Music Control fails to prepare, it is safely bypassed and Clear Voice continues.
- If Background Voices fails to prepare, it is safely bypassed and Clear Voice continues.
- No permanent PREPARING state.
- Processing visual pause/resume remains.
- Toggle OFF still releases specialist RAM immediately.
- Clear Voice worker unchanged from V23.
- De-Reverb worker unchanged from V23.

No Cloudflare model-route update is required.
