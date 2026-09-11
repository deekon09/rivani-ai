RIVANI VIDEO STUDIO V45.4 — HUMAN ONLY + TRUE ALPHA

BASE
Keeps the proven V45.2/V45.3 multiclass cutout architecture. No model swap.

FIX 1 — HUMAN ONLY
Selfie Multiclass classes:
0 background
1 hair
2 body skin
3 face skin
4 clothes
5 others/accessories

V45.4 hard-removes class 5. This is intentionally aggressive because the
product requirement is HUMAN ONLY: footballs and other held/non-human objects
should not remain.

FIX 2 — TRANSPARENT EXPORT
The old export code silently changed:
transparent -> Studio gradient
before recording. That behavior is completely removed.

Transparent mode now:
1) records processed subject color locally
2) records an alpha matte locally from the AI mask
3) loads ffmpeg.js WebM worker from jsDelivr only when needed
4) alpha-merges the two local streams
5) exports VP8 WebM with yuva420p + auto-alt-ref 0

No source frames are uploaded to RIVANI or a processing server.
The CDN supplies encoder code only.

IMPORTANT BROWSER SUPPORT
- Chrome / Edge / Firefox desktop: transparent WebM path
- Safari / iPhone: WebM alpha is not reliably supported; V45.4 shows an error
  instead of producing a fake gradient/opaque export.

CACHE BREAK
New file:
video-studio-v454.js
Do not rename.

VERIFY
Page must show:
V45.4 ENGINE ACTIVE · human-only + true-alpha export loaded

TEST ORDER
1) Same soccer video -> Studio -> Preview:
   people stay, balls/objects should be removed more aggressively.
2) Select Transparent -> Preview:
   checkerboard/no background.
3) Export Processed Video while Transparent is selected.
4) Result title must say "Transparent WebM ready".
5) Place exported WebM over another colored background in Chrome/Edge to verify alpha.
