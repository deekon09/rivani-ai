# RIVANI AI V38 — Gaming Auto Editor Experimental Lab

This is an **additive prototype only**. It is intentionally not linked from the homepage and the page carries `noindex,nofollow`.

## New files
- `gaming-auto-editor.html`
- `gaming-auto-editor.css`
- `gaming-auto-editor.js`

## What is genuinely functional now
- Gameplay video upload + local playback
- Facecam video upload and synchronized preview
- Optional separate voice/audio track
- Gameplay master timeline sync for gameplay + facecam + voice
- Real browser-side RMS/dB audio analysis
- Safe / Balanced / Aggressive silence-cut detection
- Linked cut preview: when a detected silence is skipped, gameplay + facecam + voice jump together
- Facecam shape: circle / rounded / square / hex
- 9 facecam positions
- Facecam size, border, border color and glow
- Separate facecam/gameplay brightness, contrast and saturation preview
- Editing intensity + style direction controls
- Sound Director category planning
- Energy-peak markers (signal-based, explicitly NOT semantic AI)
- Timeline visualization
- JSON edit-plan download

## Deliberately NOT faked
The following need the next AI/backend stage and are clearly labelled in the UI:
- semantic funny/shock/clutch/story detection
- face emotion/reaction understanding
- true facecam background removal
- speech transcription/captions
- licensed meme/SFX/music asset placement
- scene-aware zoom/replay decisions
- final FFmpeg/cloud rendering

## Direct test URL after deploy
`https://rivaniai.online/gaming-auto-editor`

Do not add this page to the five live public tools until the AI + rendering stages are production-ready.

## Existing stable tools
No existing tool model, DSP, worker, inference, OCR, compressor, enhancer, background-removal or audio-repair code is changed by this patch.
