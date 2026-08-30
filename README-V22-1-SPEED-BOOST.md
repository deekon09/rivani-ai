# RIVANI AI V22.1 — Speed Boost

Quality settings are unchanged.

Acceleration:
- Background Voices: WebGPU first, same-model WASM fallback.
- Music Control: WebGPU first, same-model WASM fallback.
- WASM specialist fallback uses 2–4 CPU threads when cross-origin isolation is available.
- Clear Voice remains the known-compatible full WASM path; only its CPU thread ceiling changes.
- De-Reverb worker is unchanged.
- Studio Finish and loudness/peak protection are unchanged.

During enhancement decorative page animations pause automatically and resume at the end.

`_headers` is included for Cloudflare Pages-style hosting so `/audio-repair*`
can become cross-origin isolated and unlock SharedArrayBuffer WASM threading.
If that hosting surface ignores `_headers`, the tool still works safely:
WebGPU remains available where supported, while WASM falls back to one thread.

No V22 model-proxy route changes are required.
