# RIVANI AI V25.5 — Truth Protection + Adaptive GPU

## Scope
Image Enhancer only. Audio Repair, LUKI backend and Cloudflare model-delivery Worker are not changed.

## Result review redesign
The drag Before/After slider is removed. Results now show two separate panels:
- Original — source truth
- RIVANI Enhanced — verified result

This makes visual comparison clearer and avoids the slider hiding part of either image.

## Verified Tone Lock
Color Lock now performs a second verification after final composition. If sampled luminance or color still drifts beyond a conservative range, RIVANI nudges global source color/luminosity back toward the original and re-measures the result.

The AI detail carrier is not replaced by a blur/sharpen filter. The source remains the tone truth anchor.

## Adaptive GPU V25.5
The AI model, 128x128 input tiles, context crop and output math are unchanged.

Starting profile:
- Fast: clearly strong desktop/workstation
- Balanced: capable desktop/laptop
- Cool: mobile, low-memory or weaker devices

The worker also watches repeated tile latency. If sustained inference starts slowing relative to the early stable baseline, it automatically reduces GPU duty slightly and uses smaller feed batches. This is performance/thermal pacing only; model quality and output pixels are unchanged.

## RIVANI Pro precision controls
Public accounts remain Free today. These controls are wired to the existing account plan context and only become functional when a trusted future account plan reports `Pro`.

### Logo / Critical Area Lock
A Pro user can select up to five regions on the source preview (logo, text, face, product detail, etc.). After the verified AI result is composed, those selected regions are restored from the original source with a lightly feathered boundary. This is a real source-anchor operation, not a decorative UI control.

### RIVANI Truth Map
Optional Pro result map visualizes sampled pixel change between the source and verified output. It reports preserved/adjusted/changed areas and outlines manually protected regions.

The map is a change visualization, not a claim that it can prove semantic hallucination by itself.

### Print Proof
Optional Pro output reports a conservative physical print-size estimate at 300 DPI using the actual verified output dimensions.

## Free safety remains Free
The following remain standard controls rather than being moved behind Pro:
- Fidelity Guard
- Text & Logo Safe
- Color Lock
- Safe Result behavior

## Model delivery
No Cloudflare Worker update is required from V25.4/V25.3 if `/image-enhancer-x4.onnx` is already live.
