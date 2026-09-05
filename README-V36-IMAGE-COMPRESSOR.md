# RIVANI AI V36 — Smart Image Compressor

## Upload / replace in the website repo
New files:
- `image-compressor.html`
- `image-compressor.css`
- `image-compressor.js`
- `article-image-compressor.html`
- `backend/LUKI-KNOWLEDGE-V36.md`

Replace current files:
- `index.html`
- `articles.html`
- `features.html`
- `about.html`
- `auth-nav.js`
- `sitemap.xml`
- `_headers`

## What V36 adds
- Smart Image Compressor with Easy / Exact Size / Precision modes.
- Exact KB/MB targeting with Quality-first or Strict Target behavior.
- Smart Format Race, Visual Quality Guard, Text & Logo Guard, Transparency Guard.
- Before/After, visual similarity estimate and Compression Artifact Map.
- Up to 20 images per batch, Batch Consistency and ZIP export.
- Website Pack with responsive variants and a `<picture>` snippet.
- Browser-side image decoding/resizing/re-encoding; embedded metadata is stripped by re-encoding by default.
- Sign-in gate before processing through the existing `RIVANI_REQUIRE_AUTH` flow.
- SEO: canonical, WebApplication + Breadcrumb schema, guide article, homepage/internal links and sitemap entries.
- LUKI frontend knowledge updated to four live tools and mobile quick-button wrapping fixed globally through `auth-nav.js`.

## Important backend note
`backend/LUKI-KNOWLEDGE-V36.md` is intentionally a merge reference, not a replacement `backend/worker.js`. The historical backend source in the repo contains stale launch-era information and may not match the deployed `rivani-account-api` Worker. Do not overwrite the deployed account Worker blindly. Compare the live source first, then merge the V36 knowledge block into its LUKI system prompt.

## Existing stable AI quality
No Audio Repair, Image Enhancer or Background Remover model / DSP / inference file is changed by this patch.

## Browser notes
- AVIF output is shown only when the browser can actually encode AVIF through Canvas.
- Very small exact targets can require dimension reduction in Strict Target mode.
- Visual similarity and Artifact Map are review aids, not guarantees of semantic or perceptual quality.
- Website Pack ZIP uses the existing CSP-allowed JSZip CDN (`cdn.jsdelivr.net`).
