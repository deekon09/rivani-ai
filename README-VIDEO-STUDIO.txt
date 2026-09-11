RIVANI VIDEO STUDIO V45.2 — STABLE ROLLBACK + STRICT CLEANUP

THIS IS A DELIBERATE ROLLBACK.

The fast/category/single-mask experiments from V44.2–V45.1 are removed from the cutout path.
V45.2 returns to the V44.1 multiclass engine — the version where the human stayed visible — and only improves post-processing.

ENGINE
- selfie_multiclass_256x256 (same model as V44.1)
- confidence[0] = background probability
- foreground = 1 - background probability
- correct model mask dimensions are preserved
- no binary SelfieSegmenter channel guessing
- no category-only inversion path
- no chroma-key experiment

CLEANUP CHANGES
- stricter low-confidence background removal
- moving pixels release old foreground much faster to remove trails/halos
- human-core protection prevents body/face/clothes disappearing
- catastrophic full-frame/inverted masks are stopped instead of rendered
- default Edge Clean 58%
- default Feather 0.7px
- default Temporal Smooth 24%

UI FIXES
- Choose Another Video retained
- Clear Video retained
- Ready button cannot be clicked again / no 4% second-click hang
- transparent preview stays available; export switches to Studio if alpha export is unreliable

CACHE BREAK
NEW JS FILE: video-studio-v452.js
Do not rename it.

VERIFY
Page must change the note to:
V45.2 ENGINE ACTIVE · stable multiclass cutout loaded

TEST ONLY PREVIEW FIRST:
1. same soccer video
2. Start AI Studio once
3. Studio background
4. humans must remain normal-color
5. field/trees/net should be removed
6. inspect hands/legs while moving
7. only after preview passes, export
