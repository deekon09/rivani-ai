# RIVANI AI V37.4 — PDF to Text / Scanned PDF OCR

Changed/new files only.

## Added
- PDF upload inside the existing Image to Text tool.
- Smart PDF strategy: usable text layer first, OCR only scanned/image-only pages.
- Force OCR and Text-layer-only strategies.
- All pages / scanned pages / text pages / custom page selection.
- Page preview and previous/next navigation.
- Combined document + page-wise text view.
- TXT, Markdown, JSON and best-effort Table → CSV export.
- Local privacy-pattern scan and Find-in-text for PDF results.
- Indian + World OCR language selector is reused for scanned PDF pages.
- Smart OCR Race, Tiny Text Upscale, Auto Clean, line preservation and contrast settings are reused for scanned PDF pages.
- Browser-side PDF rendering with pdf.js; no source PDF upload to the RIVANI account API.

## Safety / Beta limits
- One PDF at a time.
- Up to 40 MB and 80 pages per PDF in this Public Beta build.
- Pages are rendered/OCRed sequentially to reduce memory use.
- Password-protected PDFs are not supported yet.
- OCR output and complex PDF layouts must be reviewed; direct PDF text extraction is preferred when a usable text layer exists.

## SEO
- Image-to-Text tool metadata/schema now also describes PDF-to-text and scanned PDF OCR.
- OCR guide includes a dedicated PDF section and clean extensionless canonical URL.
- `sitemap.xml` is included with clean extensionless public URLs; Image-to-Text and its guide use `2026-09-07` lastmod.

## Important
- Existing Audio Repair, Image Enhancer, Background Remover and Image Compressor processing/model code is untouched.
- Existing image OCR engine file (`image-to-text.js`) is untouched; PDF support is additive in `image-to-text-pdf.js`.
- No `_headers` change is required for this patch because the current site CSP already permits jsDelivr scripts/workers used by the existing OCR stack.

## Deploy
Upload/replace the files in this ZIP at repository root. Then test:
1. a normal selectable-text PDF,
2. a scanned/image-only PDF,
3. selected pages,
4. one non-English OCR language on a scanned page,
5. TXT/JSON download.
