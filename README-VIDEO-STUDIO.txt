RIVANI VIDEO STUDIO V44.6 — CONFIDENCE MASK RESET

THIS VERSION REMOVES THE CATEGORY-MASK PATH ENTIRELY.

Why:
The Selfie Segmentation model's native output is a single-channel human
probability mask. Official MediaPipe documentation describes high mask values
as human and low values as background, and its reference example keeps pixels
where the segmentation mask is above about 0.1.

V44.2–V44.5 mixed this with ImageSegmenter category-mask conversions and
confidence-channel guessing. That is what allowed the whole foreground and
background to invert.

V44.6:
- uses outputConfidenceMasks only
- uses the higher-quality general selfie_segmenter model
- channel 0 is treated as HUMAN probability by default
- no category mask
- no chroma-key assist
- no class-ID checks
- strong border sanity check can flip only if the mask is obviously background
- Foreground Safety Guard prevents a high-border/full-frame mask from erasing people
- soft threshold near the official >0.1 guidance
- motion-adaptive smoothing remains, but is weaker to avoid trails
- face tracking only affects cosmetic face polish, never the foreground cutout
- Choose Another Video / Clear Video / Ready-button fix remain

CACHE CHECK:
Before starting AI, the page must show:
V44.6 CONFIDENCE MASK · Upload first...

TEST:
1) Hard refresh.
2) Confirm V44.6 text.
3) Use the same soccer video.
4) Start AI Studio once.
5) Choose Studio background.
6) People must remain visible in their real colors.
7) Do NOT export until preview is correct.

Private Beta / noindex stays in place.
