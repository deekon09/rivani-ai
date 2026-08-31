# RIVANI AI V25.10 — Shared HD Finish

## Why
V25.9 fixed mobile completion on mid-range Android, but same-size previews could still look too close to the source because mobile deliberately runs bounded selective AI tiles and the earlier pipeline prioritized fidelity over perceptual punch.

## New: RIVANI HD Finish
A lightweight post-AI finishing stage now runs on BOTH desktop and mobile using the same parameters for the same mode/strength.

It adds, in a controlled way:
- micro-detail presence / restrained local sharpening
- dimensional S-curve contrast (deeper blacks + brighter highlights without a large exposure shift)
- vibrance rather than blunt global saturation
- reduced color boost on likely skin tones to avoid orange/plastic faces
- small midtone presence lift

This is not presented as another neural model. Real-ESRGAN remains the AI reconstruction engine; HD Finish is a transparent finishing stage after AI.

## Controls
- HD Finish toggle: ON by default
- Finish strength: 0–100, default 70
- Natural: restrained
- Strong: most visible detail / contrast / vibrance
- Restore: conservative color with stronger detail recovery

## Performance / memory
- Finish is in-place on the already allocated result RGBA buffer.
- Only three one-row Float32 luminance buffers are allocated.
- No second full-resolution result copy is created.
- Mobile selective AI completion architecture from V25.9 remains unchanged.
- Desktop flagship x4plus path remains unchanged.

## Fidelity
Fidelity Guard, Text & Logo Safe, Color Lock, Safe Result, Pro critical-region locks and export behavior remain after the HD Finish stage, so excessive changes can still be reduced or safe-passed.

## Cloudflare
No model route change. Keep the V25.8 model Worker already deployed.
