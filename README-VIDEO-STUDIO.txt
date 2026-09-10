RIVANI VIDEO STUDIO V44.4 — MASK ORIENTATION FIX

REPLACE THESE 3 FILES IN REPO ROOT:
1) video-studio.html
2) video-studio.css
3) video-studio.js

CRITICAL FIX
V44.3 could invert the Selfie Segmenter confidence mask on some browser/runtime
outputs. The visible symptom is exactly what the test files showed:
- original/background stays visible
- the people become blue/studio-color silhouettes
- transparent and color modes look reversed

V44.4 fixes this by:
- enabling the authoritative category mask
- using category 0 = background and category 1 = person
- auto-validating any single confidence mask against the category result
- never blindly assuming confidence channel orientation
- removing the experimental green/blue chroma assist for now
- keeping motion-adaptive temporal smoothing
- reducing destructive defaults to Edge Clean 52%, Feather 1px, Temporal 44%
- keeping Choose Another Video, Clear Video and the fixed disabled Ready button

TEST FIRST
Use the same 30-second soccer/men video:
1) Upload.
2) Start AI Studio ONCE.
3) Test Studio background first.
4) People should remain normal-color and the environment should be replaced.
5) Then test Blur and White.
6) Only after preview looks correct, export 720p.

PRIVATE BETA / NOINDEX remains intentional.
