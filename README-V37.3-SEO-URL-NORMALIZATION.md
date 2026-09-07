# RIVANI AI V37.3 — SEO URL Normalization

Purpose: resolve Search Console redirect noise caused by sitemap/canonical/internal links using `.html` while Cloudflare Pages serves clean extensionless routes.

Changes:
- public canonical/OG/schema URLs normalized to extensionless routes
- public internal links normalized to extensionless routes
- sitemap now lists extensionless canonical URLs only
- explicit `_redirects` aliases send `.html` public URLs to the clean route in one hop
- auth/dashboard/admin/pro/calculator routes were intentionally not changed
- no AI model, inference, DSP, compressor logic, OCR logic, auth logic, or backend worker was modified

Deploy the files in this ZIP at repository root, preserving filenames.
After Cloudflare deploy: test one old `.html` URL and its clean URL, then use Search Console Validate Fix for Redirect error.
