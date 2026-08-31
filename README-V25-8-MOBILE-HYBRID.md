# RIVANI AI V25.8 — Mobile Hybrid Image Engine

## Why V25.7 was still slow on mid-range Android
V25.7 correctly paced WebGPU, but it still ran the full flagship 16.7M-parameter
x4 image network on every prepared 128px tile. On a mid-range mobile GPU, adding
more pauses can reduce sustained pressure but cannot remove the underlying compute;
it can also make the total job take even longer.

## V25.8 architecture
Desktop behavior remains flagship-first.

Mobile now uses a two-stage browser AI pipeline:

1. Efficient general-scene 4x AI builds the complete result.
2. The source is scored tile-by-tile for detail/edge importance.
3. The flagship detail engine refines only the most important tiles.
4. Refined regions are feathered into the efficient base at external boundaries.
5. Existing Fidelity Guard / Text & Logo Safe / Color Lock verify the final result.

Strong mode refines a larger share than Natural. Restore gets the largest flagship
share. A few central tiles are protected for portrait/product compositions even
when their raw edge score is lower.

## Model delivery
New route required for best reliability/cache behavior:

`/image-enhancer-mobile-x4.onnx`

Deploy `cloudflare-rivani-models-v25-8-mobile-worker.js` to the existing
`rivani-models` Worker. Existing audio and x4plus routes remain unchanged.

The browser also has a direct model fallback, so a missing proxy route should not
make the page permanently unusable, but the Cloudflare route is the production setup.

## Safety / quality
- Desktop flagship model path unchanged.
- Mobile is no longer pixel-identical to running x4plus on every tile; that would
  require essentially the same compute and cannot honestly be made dramatically
  faster on a mid-range phone without changing the workload.
- Flagship processing is reserved for visually important mobile regions to retain
  detail where users notice it most.
- Same source truth anchor and Fidelity Guard remain after the hybrid result.
- No paid server GPU is introduced.

## UI responsiveness
The V25.7 requestAnimationFrame UI-pressure feedback remains. In V25.8 it mainly
paces the smaller number of flagship refinement tiles instead of slowing the entire
full-image flagship pass.
