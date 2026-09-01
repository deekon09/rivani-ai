# RIVANI AI V27 — Cutout Studio

## What changed
- Background Remover is now a live browser-side tool at `background-remover.html`.
- New files: `background-remover.html`, `background-remover.css`, `background-remover.js`, `background-remover-worker.js`.
- Existing Image Enhancer and Audio Repair engines were not changed.
- Home, Features, Articles, LUKI fallback knowledge and LUKI backend product context now mark Background Remover as live.

## Free product rule
- All Background Remover quality and refinement controls are available on Free.
- Free accounts get 9 successful background removals per local calendar day.
- Failed jobs do not consume a removal.
- At 9/9 the Remove button locks and the RIVANI Pro purchase prompt appears.
- Pro entitlement is read from the existing Firebase auth context; billing is still a placeholder until a gateway is connected.

## Signup gate
The existing `RIVANI_REQUIRE_AUTH` gate is used. A signed-out user can choose a file, but pressing Remove Background asks them to sign up/log in before processing.

## Cutout engines
### Precision
- 1024×1024 alpha matting path.
- WebGPU only.
- Browser model delivery route: `/background-remover-birefnet.onnx`.
- Model source: `runes/birefnet-lite-webgpu` (MIT), an fp16 browser-WebGPU graph derived from BiRefNet-lite.

### Fast compatibility
- 320×320 portable saliency/matting path.
- WASM single-thread fallback for broad compatibility.
- Browser model delivery route: `/background-remover-fast.onnx`.
- Model source: `edgetools/u2netp` (Apache-2.0 upstream U²-Net weights).

Auto prefers Precision on WebGPU-capable desktop and sufficiently capable mobile devices, then falls back to Fast if the precision session fails. Low-memory mobile devices start with Fast to avoid a large-model crash.

## RIVANI processing animation
During model load/inference the processing overlay uses the existing official `assets/rivani-r-mark.png` ribbon-R mark with a functional rotating progress ring. No generated logo or plain letter R is used.

## Included Cutout Studio controls
- Auto / Hair / Product / Glass / Logo presets
- Edge Clean
- Expand / Contract
- Feather
- Edge Decontaminate using a conservative corner-background estimate
- Multi-subject connected-region picker
- Cutout Guard score
- Hardest Edge preview
- Manual Erase / Restore alpha brush
- Undo / Reset AI mask
- Transparent / White / Black / Blur / Studio Gradient / Custom Color / Custom Image backgrounds
- Generated Studio Shadow
- Product export canvas: Original / 1:1 / 4:5 / 16:9 plus padding
- Transparent PNG / transparent WebP / composite JPEG
- Alpha Mask PNG
- Shadow Layer PNG
- Asset Pack ZIP
- Before/After drag comparison slider

## Cloudflare model Worker
Deploy `cloudflare-rivani-models-v27-cutout-worker.js` over the existing `rivani-models` Worker. It preserves all existing audio and image-enhancer routes and adds only:
- `/background-remover-birefnet.onnx`
- `/background-remover-fast.onnx`

Expected `/health` route count after deployment: 8.

## Privacy truth
Image pixels are processed in the browser. Model weights are downloaded through the RIVANI model-delivery Worker and cached by normal browser/HTTP caching behavior. Export encoding happens locally.

## Production note
The 9/day quota currently follows the same client-side account-scoped localStorage pattern as the Image Enhancer implementation. Before paid launch, move quota enforcement and Pro entitlement enforcement to a trusted backend so DevTools/localStorage changes cannot bypass it.
