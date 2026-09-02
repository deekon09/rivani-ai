RIVANI V34 — Brand SEO + Mobile LCP Phase

Changed files only:
- index.html
- about.html
- script.js
- _headers

What changed:
1) Brand SEO/entity signals
   - Added Organization + WebSite schema on homepage.
   - Added AboutPage + Organization schema on About.
   - Added official-domain and slogan wording.
   - Linked the official public GitHub repository in schema.

2) Mobile PageSpeed/LCP
   - Homepage hero carousel no longer auto-rotates at ~5.2 seconds.
     This prevents a late lazy-loaded slide from becoming a new LCP candidate.
   - Preloads the tiny Audio SVG that is used in the first hero tool slide.
   - The large PNG wordmark is now low fetch-priority so it does not compete with hero LCP.
   - Added intrinsic 900x560 dimensions to homepage SVG illustrations.
   - LUKI reuses the already-loaded official full RIVANI wordmark and crops the R,
     instead of requesting the separate ~333 KB R-mark PNG.

3) Cache cleanup
   - Removed the temporary Clear-Site-Data: "cache" headers now that V33 is confirmed working.
   - Normal no-store rules for Beta HTML/scripts remain.

Not touched:
- Audio model / DSP / inference
- Image Enhancer quality pipeline
- Background Remover model
- rivani-models Worker
- Account/payment backend

After deploy:
- Re-run PageSpeed Insights on homepage Mobile + Desktop.
- Compare against baseline:
  Mobile: 76 / 90 / 92 / 100, LCP 7.4s
  Desktop: 94 / 95 / 92 / 100, LCP 1.6s
- Search Console does not need another sitemap submission.

Remaining external brand SEO (not a code patch):
- Create/maintain official social/profile pages and link them consistently.
- Earn relevant backlinks/mentions over time.
