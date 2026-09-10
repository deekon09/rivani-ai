RIVANI VIDEO STUDIO V44.3 — PURE CUTOUT / MOTION FIX

REPLACE THESE 3 FILES IN REPO ROOT:
1) video-studio.html
2) video-studio.css
3) video-studio.js

FIXED
- No more second-click "AI Ready -> 4%" stuck overlay.
- Ready button becomes disabled: ✓ Background AI Ready.
- Choose Another Video added.
- Clear Video added.
- Faster MediaPipe Selfie Segmenter Landscape is now the primary person/background model.
- Motion-adaptive temporal smoothing refreshes edges faster when hands/body move.
- Stronger default cutout: Edge Clean 65%, Feather 0.8px, Temporal 55%.
- Lightweight BlazeFace tracks the face region for smoothing/light instead of using the slow multiclass model every frame.
- Automatic Green/Blue Screen Assist activates only when the outer scene strongly resembles a screen.
- High-confidence person pixels are protected so green/blue clothing is not blindly keyed out.
- Transparent preview remains available.
- Export does not stop with the old transparent warning; if alpha cannot be guaranteed by MediaRecorder, export switches to Studio background automatically.

WHY THIS VERSION IS BETTER FOR DANCE / MOVEMENT
The previous multiclass segmentation path is much slower. V44.3 uses the dedicated real-time selfie/person model for the cutout and keeps face tracking separate. That allows more frequent person-mask refreshes and less trailing background around moving hands/body.

PRIVATE BETA
Keep noindex. Do not add homepage/sitemap until the same sample and at least one normal-room face-cam video pass.
