# RIVANI V16.1 — Model Fetch Fix

## Why V16 showed "Failed to fetch"

The MossFormer2 model is ~229 MB and Hugging Face now serves many large files
through redirect/Xet/CDN infrastructure.

A browser can fail that cross-origin chain before ONNX Runtime ever gets the
model. That is why V16 returned:

Clear Voice X could not finish -> Failed to fetch

This is a model-delivery failure, not an audio-denoising result.

## Fix

V16.1 adds a tiny Cloudflare Worker:

`rivani-models`

It does NOT run AI.
It does NOT use Workers AI.
It does NOT use a GPU.
It only streams the public MossFormer2 ONNX file from Hugging Face to the
browser with reliable CORS headers.

Actual inference still happens in the user's browser through WebGPU/WASM.

## Step 1 — Create Cloudflare Worker

Cloudflare Dashboard
-> Workers & Pages
-> Create
-> Worker
-> name: `rivani-models`

Paste:

`model-proxy-worker/worker.js`

Deploy.

Expected URL:

`https://rivani-models.rivani.workers.dev`

Open:

`https://rivani-models.rivani.workers.dev/health`

You MUST see JSON similar to:

`{"ok":true,"service":"rivani-models","model":"MossFormer2_SE_48K","inference":"browser","gpu":false}`

Do not deploy the website V16.1 until /health works.

## Step 2 — Deploy website

Upload/replace the V16.1 website files in GitHub root.
Cloudflare deploy.
Ctrl+F5.

Then test the SAME short original audio.

## First repair

The browser will automatically load the ~229 MB model.
No manual user install is required.

The first load can take time depending on internet speed.
After a successful load, the browser stores the model in CacheStorage.

## Cost

No server GPU is used.

The proxy uses an ordinary Cloudflare Worker request and a streamed HTTP
subrequest. Keep normal Cloudflare Free-plan limits in mind; this is not an
"unlimited forever" guarantee.

## Diagnostic improvement

V16.1 validates that the fetched file is actually around the expected model
size. If Hugging Face returns HTML, JSON, a tiny LFS pointer, or a truncated
file, RIVANI reports that instead of failing later with a vague ONNX error.
