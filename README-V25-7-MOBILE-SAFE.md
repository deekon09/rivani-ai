# RIVANI AI V25.7 — Mobile Safe Image Engine

## Why
Mid-range Android phones can run WebGPU inference but the AI queue shares GPU time
with the browser compositor. Sustained 4× tile inference can therefore make scrolling
janky even when inference itself is working correctly.

## Changes
- New Mobile Safe runtime profile for Android/iOS/coarse-pointer devices.
- Mobile WebGPU skips graph capture and uses responsive duty-cycle pacing.
- Main page measures real requestAnimationFrame delay and sends UI-pressure feedback
  to the worker; the worker backs off only while visible jank is detected.
- Same Real-ESRGAN model, 128×128 tiles, context, Fidelity Guard and pixel math.
- Mobile output-memory ceilings are device adaptive (22–32 MP) to avoid browser RAM
  pressure from very large RGBA canvases. Oversized requests are capped rather than
  rejected; the UI continues to report effective scale.
- While processing on mobile, decorative ambient/grid effects are paused so the GPU
  compositor has more room. Functional processing animation remains.
- Fixed mobile processing R mark alignment; an old 180px mobile image-width rule was
  causing the logo to shift/overflow.
- Desktop Fast/Balanced behavior remains unchanged.
- No Cloudflare model-worker update required.
