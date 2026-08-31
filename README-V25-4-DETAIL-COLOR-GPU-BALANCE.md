# RIVANI AI V25.4 — Detail / Color / GPU Balance

## Scope
This patch changes only the Image Enhancer runtime and verification behavior.
Audio Repair, LUKI, authentication, payment placeholders, and the Cloudflare model Worker are unchanged.

## Strong / Maximum Detail
- Strong verified AI blend: up to 96%
- Removed the old global 84% Text & Logo Safe cap
- Text & Logo Safe is now verification-responsive instead of weakening every photo
- Mild, normal Real-ESRGAN variation no longer automatically collapses Strong to 70%
- True high-risk Fidelity Guard still performs a 0% AI Safe Pass

## Color Lock V25.4
Fidelity measurement now tracks luminance drift in addition to structure, sampled color difference, and edge energy.
Color Lock uses conservative chroma/luminosity correction from the original source instead of solving ordinary drift only by lowering AI detail strength.
This is intended to prevent the darker-result behavior observed in real photo tests while preserving AI micro-detail.

## Adaptive GPU Balance
Performance profile is automatic:
- FAST: clearly strong desktop/workstation
- BALANCED: common 6–8+ core PC/laptop
- COOL: mobile/weak device

WebGPU pacing uses a measured duty cycle between tile batches. No model weights, tile size, context, output sampling, or Fidelity Guard pixels are changed.
Compatibility/WASM inference is not deliberately slowed.

## Unchanged quality contract
- Real-ESRGAN x4plus ONNX
- 128x128 model input
- 8px context / 112px core tiling
- native 4x model output
- 2x from native model output reduction
- WebGPU first / WASM fallback
- browser-side image processing

## Deployment
Upload/replace this project over V25.3 and hard-refresh.
Do NOT change the already-working `rivani-models` Cloudflare Worker.
