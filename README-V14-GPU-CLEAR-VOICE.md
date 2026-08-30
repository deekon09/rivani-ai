# RIVANI AI V14 — GPU Clear Voice

This build changes the Audio Repair architecture.

## What changed

The old browser-only Natural / Clean / Studio denoise engines are removed from the main quality path.

The new user flow is:

Upload -> Scan -> Noise Removal strength -> Repair My Audio -> Before / After -> Download WAV

Natural / Broadcast / Studio are now only optional **Voice Finish** choices. They do not switch the denoise engine.

## Main GPU engine

Primary model: **Resemble Enhance**
- dedicated denoiser
- speech enhancer/restoration
- trained around high-quality 44.1 kHz speech
- official inference code already chunks long audio in ~30 second segments with overlap

The GPU service runs on Modal with an L4 GPU.

## Architecture

Browser
-> `https://rivani-audio-api.rivani.workers.dev`
-> Firebase ID-token validation
-> shared-secret request to Modal
-> Modal L4 GPU
-> Resemble Enhance
-> LUFS-style voice finish + peak guard
-> WAV result

This keeps the Modal shared secret out of browser code.

## IMPORTANT: do not replace the live site until the GPU backend is connected

The V14 frontend intentionally expects:

`https://rivani-audio-api.rivani.workers.dev`

### Step A — Deploy Modal GPU backend

Folder:
`gpu-backend/modal_app.py`

On a computer with Python:

1. Install Modal:
   `python -m pip install modal`

2. Authenticate:
   `modal token new`

3. Create a long random shared secret. Example command format:
   `modal secret create rivani-audio-secret RIVANI_API_SECRET=YOUR_LONG_RANDOM_SECRET`

4. From the `gpu-backend` folder:
   `modal deploy modal_app.py`

5. Modal will print/show the deployed ASGI URL.
   Save the base URL. It normally looks similar to:
   `https://YOUR-WORKSPACE--rivani-clear-voice-api.modal.run`

First deployment can take time because the image installs PyTorch/DeepSpeed/Resemble Enhance and bakes the official model checkpoint.

### Step B — Create a NEW Cloudflare Worker

Do NOT replace `rivani-account-api`.

Create a separate Worker named:

`rivani-audio-api`

Paste:
`audio-api-worker/worker.js`

Add Variables:
- `FIREBASE_WEB_API_KEY` = the same Firebase web API key already used by RIVANI
- `ALLOWED_ORIGIN` = `https://rivani-ai.rivani.workers.dev`
- `MODAL_API_BASE` = the Modal URL from Step A

Add Secret:
- `MODAL_API_SECRET` = EXACTLY the same random value used for `RIVANI_API_SECRET` in Modal

Deploy.

Health check:
`https://rivani-audio-api.rivani.workers.dev/health`

Expected shape:
`{"ok":true,"service":"rivani-audio-api","gpuBackendConfigured":true,"authConfigured":true}`

### Step C — Deploy website V14

Only after A + B are working:
upload/replace the V14 website files in GitHub and let Cloudflare deploy.

Hard refresh:
Ctrl + F5

Open:
`/audio-repair.html`

Sign in and test the exact noisy voice sample again.

## Beta limits in this package

- Requires signed-in RIVANI account
- Max request body: 100 MB
- GPU function timeout: 30 minutes
- Long-form production quotas/rate limits are NOT finalized yet

The earlier 45-minute Free-plan idea should not be treated as production-ready until GPU cost and processing speed have been measured.

## Why this should sound different from V13

V13 tried to combine browser RNNoise/DeepFilter/restoration logic. Your test files showed metallic/shimmer artifacts and too little meaningful separation between settings.

V14 does not stack browser denoisers as the main engine.

Resemble Enhance performs speech denoising + perceptual restoration as one dedicated server-side model path, then RIVANI only applies restrained loudness/peak finishing.

## Still future

These require separate models:
- background music separation
- overlapping speaker removal
- target-speaker isolation
- independent Fan / Traffic / Music sliders
- advanced de-reverb
