# RIVANI AI V25.9 — Mobile Completion / Selective AI

## Why V25.8 could fail on both 2× and 4×
The image network is a native 4× model. Requesting 2× did not halve neural inference;
it still ran the same 4× network and reduced the native result afterward.

The previous mobile planner also bounded output memory but could still create hundreds
of 128px model tiles. V25.8 then had a fixed 12-minute wall-clock watchdog, so a job
that was still progressing could be terminated with the same message on both 2× and 4×.

## V25.9 mobile architecture
Desktop remains full flagship x4plus.

Mobile now uses RIVANI Mobile Selective AI:
1. Build a high-quality source-preserving output base.
2. Score source tiles for real detail/edge information.
3. Run the efficient Real-ESRGAN General x4v3 model only on a bounded set of the
   most important tiles.
4. Reserve central portrait/product tiles even when raw edge score is lower.
5. Feather AI regions into the source-preserving base.
6. Run the existing Fidelity Guard / Color Lock / Text & Logo Safe verification.

Strong, Natural and Restore still change how much important mobile detail receives
real AI processing, but mobile jobs no longer sweep every tile simply because the
source is large.

## Mobile memory safety
The mobile output canvas budget is now more conservative (roughly 12–18 MP depending
on reported device memory/cores). Effective scale is reported honestly in the result.
This avoids allocating extremely large RGBA canvases/PNG encoders that can cause an
Android browser process to be killed.

## Timeout behavior
The old fixed 12-minute mobile kill was replaced by a progress-aware watchdog:
- progressing jobs are not killed at exactly 12 minutes;
- a genuinely stalled engine is stopped safely;
- there remains a bounded absolute mobile safety window.

## Cloudflare
No new model route is needed beyond V25.8. Keep both:
- /image-enhancer-x4.onnx
- /image-enhancer-mobile-x4.onnx

## Unchanged
- Desktop flagship image path
- Fidelity Guard / Safe Result philosophy
- Audio Repair
- LUKI
- Existing audio model routes
