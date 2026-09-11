RIVANI VIDEO STUDIO V45.0 — CACHE RESET + REAL PERSON CHANNEL

WHY EVERY PREVIOUS FIX LOOKED THE SAME
V44.2, V44.3, V44.4, V44.5 and V44.6 HTML files all still referenced:
  video-studio.js?v=44.1
So the browser/CDN could keep executing the old cached V44.1 engine while the
visible HTML version marker changed.

V45.0 BREAKS THAT CACHE COMPLETELY.

UPLOAD THESE FILES TO REPO ROOT:
1) video-studio.html                (replace)
2) video-studio.css                 (replace)
3) video-studio-v450.js             (NEW filename)
4) README-VIDEO-STUDIO.txt          (optional)

IMPORTANT:
Do NOT rename video-studio-v450.js back to video-studio.js.
The new filename is the cache break.

ENGINE:
- MediaPipe ImageSegmenter SelfieSegmenter
- confidence channel 0 = background
- confidence channel 1 = person
- V45 uses channel 1 only for foreground
- no category-mask conversion
- no polarity guessing
- no chroma guessing
- if the runtime does not return the expected two channels, V45 stops with an
  error instead of erasing humans by guessing.

VERIFY BEFORE TESTING:
After page load, the note must change from:
  V45.0 HTML READY...
to:
  V45.0 JS ACTIVE · new engine file loaded · upload a video to begin.

If you do not see "V45.0 JS ACTIVE", the new JS file is not being loaded.

TEST:
1) Open /video-studio.html?v=45
2) Confirm "V45.0 JS ACTIVE".
3) Upload the same soccer video.
4) Start AI Studio once.
5) Choose Studio background.
6) Preview only.
7) Expected: men remain visible in original colors; field/trees/net are replaced.
8) Do not export until preview is correct.

Keep Private Beta / noindex.
