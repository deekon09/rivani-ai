RIVANI VIDEO STUDIO V44.5 — GPU MASK VALUE FIX

Replace:
- video-studio.html
- video-studio.css
- video-studio.js

Based on the actual V44.4 failed soccer output:
background stayed visible while people became blue/studio silhouettes.

Cause:
Selfie Segmenter is documented as 0=background, 1=person, but a WebGL-backed
category mask can become 0/255 when converted to Uint8. V44.4 used ===1.

V44.5:
- reads category mask as Float32 first
- tests person with >0.5, never ===1
- Uint8 fallback treats any non-zero category as person
- automatically correlates every confidence channel with category-person pixels
- automatically inverts a reversed confidence channel
- category decides the core; confidence only softens edges
- no chroma assist
- Ready-button hang fix, Choose Another Video and Clear Video retained

CACHE CHECK:
Before Start AI Studio, UI must show:
V44.5 · Upload first. AI model loads only when processing starts.

TEST:
Hard refresh, use the same soccer video, choose Studio preview first.
Men should stay normal-color; field/trees/net should be replaced.
Do not export until preview is correct.
