RIVANI FINAL SEO + CALCULATOR + AUDIO V25.1

UPLOAD/REPLACE all files from this ZIP in the ROOT of deekon09/rivani-ai.

AUDIO SPEED
- rivani-ai-worker.js: same MossFormer2 48 kHz model/DSP.
- Uses ONNX Runtime hybrid executionProviders ["webgpu","wasm"] on compatible desktop Chromium.
- Supported graph nodes can stay on GPU; unsupported nodes may fall back to WASM instead of forcing the entire session to CPU.
- If hybrid execution fails at runtime, the existing full-quality WASM fallback remains.
- Processing text shows "GPU accelerated" when the hybrid path is actually active.
- No sample-rate reduction, model swap, strength reduction or segment skipping.
- _headers keeps the AI worker uncached during Beta.

CALCULATOR / SEO
- Advanced Student Calculator is a main live tool on Home and Features.
- New /article-calculator guide.
- Calculator guide added to Home articles and Articles hub.
- Every existing article gets a visible Calculator internal-link CTA.
- Calculator page links to its guide.
- About/Features stale five-tool copy changed to six live tools.
- Home + Articles structured data expanded.
- Sitemap adds /article-calculator and updates modified dates.
- Planned guide pages (PDF Assistant, Text Tools, Video Subtitles) get noindex,follow while those tools are not live.

VIDEO STUDIO
- This ZIP does NOT restore or include Video Studio files.
- Keep Video Studio removed/paused as previously planned.

AFTER DEPLOY
1. Hard refresh /audio-repair.
2. Test a 20-30 second recording.
3. During processing, if text starts with "GPU accelerated · AI enhancing segment...", hybrid GPU path is active.
4. If it does not say GPU accelerated, the browser/device is on the stable CPU path.
5. Submit/re-submit https://rivaniai.online/sitemap.xml in Google Search Console after deploy.

SEO note: these changes improve crawlability, consistency and internal linking; they do not guarantee rankings.
