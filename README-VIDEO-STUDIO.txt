RIVANI VIDEO STUDIO V44.1 — MASK GEOMETRY + SOFT ALPHA FIX

REPLACE THESE 3 FILES IN REPO ROOT:
- video-studio.html
- video-studio.css
- video-studio.js

Fixes from the uploaded V44.0 test:
- fixes concentric/ring background artifact caused by treating MediaPipe mask data as video-frame geometry
- reads the real MPMask width/height
- uses soft confidence masks (1 - background confidence) for cleaner hair/person alpha
- face smoothing uses face confidence mask
- keeps temporal smoothing
- mobile CPU / desktop GPU-with-CPU-fallback behavior retained
- blocks unreliable transparent MediaRecorder export instead of silently producing black/invalid transparency

TEST FIRST:
1. Upload the same 9.9 s sample.
2. Start AI Studio.
3. Confirm transparent preview has no white rings.
4. Select Studio or Blur and export 720p.
5. Check full video motion and edges.
6. Then test a normal room/no-green-screen face-cam clip.

Do not add to homepage/sitemap yet.
