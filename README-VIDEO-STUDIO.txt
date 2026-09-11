RIVANI VIDEO STUDIO V45.3 — HUMAN-ONLY POLISH

BASE
This keeps the V45.2 stable multiclass segmentation engine because the uploaded
soccer result proved the core cutout is finally correct:
- people remain visible
- field / trees / net are replaced

V45.3 DOES NOT CHANGE THE MODEL ARCHITECTURE.

POLISH FIXES
1) Whole-body Soft Glow removed.
   The old effect blurred the entire cutout and caused a purple/white halo.
   Soft Glow now applies to the detected face only.

2) Human-only multiclass filtering.
   Official SelfieMulticlass classes:
   0 background
   1 hair
   2 body-skin
   3 face-skin
   4 clothes
   5 others/accessories
   Classes 1-4 are protected.
   Background is vetoed aggressively.
   Class 5 is mostly removed so held/non-human objects are less likely to stay.

3) Faster motion cleanup.
   When a pixel changes from foreground to background, old alpha releases much
   faster to reduce trails behind arms, shoulders and legs.

4) Safer defaults.
   Edge Clean 50%
   Feather 0.7px
   Temporal 22%
   Soft Glow 0%

CACHE BREAK
New filename:
  video-studio-v453.js
Do not rename it.

VERIFY
Page must show:
  V45.3 ENGINE ACTIVE · human-only polish loaded

TEST
Use the same soccer video -> Studio -> Preview AI.
Check:
- hair / shoulders: no bright body halo
- moving arms: less trailing
- field / trees / net: removed
- football / non-human objects: more aggressively removed
- people: remain normal and intact

Do not change model/DSP architecture again unless this stable base fails.
