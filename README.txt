RIVANI V33 cache reset

Upload/replace only _headers at repo root.

Why:
Old V30 script URLs were previously cached as immutable in browsers.
The V33 JS is already in GitHub, but some browsers can keep using the old cached copy.

This temporary header makes the 4 affected pages clear browser cache on load:
- audio-repair.html
- image-enhancer.html
- background-remover.html
- contact.html

After deployment:
1. Open each page once.
2. Refresh once.
3. Confirm Beta controls and Turnstile.
4. Once confirmed, remove Clear-Site-Data later to avoid clearing cache on every visit.

AI models / inference are untouched.
