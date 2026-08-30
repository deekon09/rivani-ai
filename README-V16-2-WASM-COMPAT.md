# RIVANI V16.2 — MossFormer2 WASM Compatibility Test

The V16.1 screenshot proved two things:

1. The RIVANI model proxy is working.
2. The 229 MB MossFormer2 ONNX file reaches the browser.

The failure happens after download while ONNX Runtime is creating the inference
session:

`Could not find an implementation for Cast(13) ...`

V16.2 changes the runtime path.

## Change

V16/V16.1 imported the ONNX Runtime WebGPU/JSEP bundle and then attempted a
WASM fallback inside that bundle.

V16.2 imports the standard full ONNX Runtime Web bundle:

`ort.min.mjs`

and uses only:

`executionProviders: ["wasm"]`

for this compatibility test.

This intentionally sacrifices WebGPU speed temporarily. The goal is to answer
one question cleanly:

Can the existing MossFormer2 ONNX graph run in the full browser WASM backend?

## Result interpretation

If V16.2 works:
- keep MossFormer2
- next optimize WebGPU separately
- do NOT change the audio engine again

If V16.2 still reports the same Cast(13) node:
- model download is NOT the problem
- Cloudflare proxy is NOT the problem
- audio input is NOT the problem
- the published ONNX graph is not browser-compatible as-is
- next step is a browser-safe FP32 MossFormer2 export / graph rewrite

Do not fall back to RNNoise/DeepFilter just to make the button "work".

## Deploy

The `rivani-models` Worker does not need to change.

Upload/replace V16.2 website files in GitHub root.
Cloudflare deploy.
Ctrl+F5.
Test the same short clip again.

Because the model may already be in browser CacheStorage, the second attempt
should not need the full model download again.
