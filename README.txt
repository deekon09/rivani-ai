RIVANI AI V35.4 — Brand/Favicon SEO identity patch

UPLOAD/REPLACE ONLY THESE FILES:
- index.html
- about.html
- audio-repair.html
- image-enhancer.html
- background-remover.html
- favicon.ico
- assets/rivani-ai-favicon.png

WHAT CHANGED
- Adds an explicit square 512x512 RIVANI favicon on the homepage and all 3 live tool pages.
- Adds favicon.ico fallback for browsers.
- Strengthens RIVANI AI Organization/WebSite identity with alternateName signals.
- Links all 3 WebApplication schemas to the official RIVANI AI organization entity.
- Keeps production canonicals at https://rivaniai.online/.
- Does NOT change AI models, inference, DSP, tool controls, styles, performance logic, auth, or Beta entitlement logic.

AFTER DEPLOY
1. Open https://rivaniai.online/ and hard-refresh once.
2. In Google Search Console -> URL Inspection -> inspect the homepage -> Request indexing once.
3. Favicon changes can take several days to several weeks to appear in Google Search.

WWW / WORKERS.DEV
Do not solve hostname redirects by editing these site files. Configure Cloudflare redirect rules separately so:
- www.rivaniai.online/* -> https://rivaniai.online/$1 (301)
- rivani-ai.rivani.workers.dev/* -> https://rivaniai.online/$1 (301)
Preserve path and query string.
