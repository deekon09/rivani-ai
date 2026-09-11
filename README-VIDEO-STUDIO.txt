RIVANI VIDEO STUDIO V45.5 — NATIVE VP9 ALPHA EXPORT

WHAT THE SCREENSHOT PROVED
V45.4 reached 70% and then failed with:
  No such filter: alphamerge
  Error initializing complex filters
  Invalid argument

Cause:
The ffmpeg.js "webm" build is intentionally minimal and does not include the
alphamerge video filter. The AI cutout was not the failure; the final alpha
merge step was.

V45.5 FIX
The ffmpeg.js alpha pipeline is removed completely.

Transparent export now uses:
- Mediabunny 1.56.1
- browser WebCodecs VideoEncoder
- CanvasSource with alpha: "keep"
- VP9
- WebM container that supports VP9 alpha side data
- Opus audio when the browser can encode it

There is NO:
- ffmpeg.js worker
- matte recording
- alphamerge filter
- forced Studio gradient fallback

TRANSPARENT SAFETY FIX
V45.4 also painted "Studio Light" on the final canvas. On a transparent canvas,
that could create faint semi-transparent pixels outside the person.
V45.5 moves Studio Light inside the subject mask, so transparent background
pixels remain clear.

HUMAN-ONLY CUTOUT
The V45.3/V45.4 stable multiclass cutout is retained.
Class 5 (others/accessories) remains hard-removed.

CACHE BREAK
New engine file:
  video-studio-v455.js
Do not rename it.

VERIFY
Page must show:
  V45.5 ENGINE ACTIVE · human-only + native VP9 alpha export loaded

TEST
1) Open /video-studio.html?v=455
2) Confirm V45.5 ENGINE ACTIVE.
3) Upload the same soccer video.
4) Start AI.
5) Choose Remove/Transparent.
6) Preview must show checkerboard behind the people.
7) Export.
8) Result should say "Transparent WebM ready".
9) Test the exported WebM over a colored webpage/background in Chrome.
   Some desktop media players display transparent video over black even when
   the alpha channel is valid.

If the browser reports that VP9 alpha is unsupported, V45.5 stops with a clear
error. It never replaces transparency with a gradient.
