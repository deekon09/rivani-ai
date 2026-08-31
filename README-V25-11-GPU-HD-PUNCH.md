# RIVANI AI V25.11 — Reliable GPU + HD Punch

## Why this patch exists
Two real-device regressions were observed after V25.10:

1. A high-end desktop could drop from WebGPU to CPU/WASM after a GPU/graph-capture hiccup, causing very slow progress and high CPU usage.
2. Mobile completion was finally reliable, but Strong + HD Finish could still look too close to the source at normal viewing size.

## Desktop GPU reliability
- Desktop flagship processing keeps the full Real-ESRGAN x4plus path.
- Production desktop session now starts with regular WebGPU instead of relying on graph capture.
- A runtime WebGPU hiccup first recreates/retries regular WebGPU.
- WASM/CPU is now the final compatibility fallback, not the first recovery step.
- Desktop model, tiling, context, Fidelity Guard and output quality are unchanged.

## Mobile portrait detail priority
- Mobile keeps the V25.9 bounded Selective AI tile budget, so completion/performance does not regress.
- Portrait/selfie images re-rank the same tile budget toward the face/hair/glasses/central identity region.
- No increase in the mobile neural-call ceiling was made.

## Stronger RIVANI HD Finish
- Strong mode now has a visibly stronger local-contrast/definition curve.
- Vibrance increase is materially stronger on scenery/clothing/background colors.
- Skin receives reduced chroma and local-detail gain to avoid orange/plastic faces.
- Micro-contrast is clamped to limit halos.
- The finish remains an in-place post-AI stage; it does not allocate a second giant image buffer.
- The same finish algorithm/strength is used on mobile and desktop.

## Safety
Fidelity Guard, Text & Logo Safe, Color Lock, Safe Pass, export options and Pro truth-protection features remain in place.

## Cloudflare
No model-worker change is required from V25.8/V25.9. Existing flagship and mobile model routes remain valid.
