RIVANI VIDEO STUDIO V44.0 — PRIVATE BETA

UPLOAD THESE FILES TO REPO ROOT:
1) video-studio.html
2) video-studio.css
3) video-studio.js

DO NOT add it to homepage or sitemap yet.
The page is intentionally noindex,nofollow until real-device testing passes.

TEST ORDER:
1) Upload 10–20 sec face-cam MP4.
2) Click Start AI Studio.
3) Verify person cutout without green screen.
4) Test Blur, Studio, White, Black, Custom Color, Custom Image.
5) Test Face Smooth, Studio Light, Glow, Clarity, Warmth.
6) Preview AI.
7) Export 720p first, then 1080p.
8) Confirm audio is present.
9) Confirm transparent mode on WebM in your target Chrome/Edge; alpha support can vary by encoder.

TECH:
- @mediapipe/tasks-vision 1.0.1
- MediaPipe Selfie Multiclass 256x256
- Browser-side segmentation/compositing
- Canvas captureStream + MediaRecorder export
- Sign-in gate only starts when AI processing begins
- No paid API / no RIVANI cloud GPU required

STABILITY NOTE:
- Mobile uses CPU segmentation intentionally for compatibility.
- Desktop tries GPU first and falls back to CPU if initialization fails.
