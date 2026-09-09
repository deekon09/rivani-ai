RIVANI MUSIC — BROWSER V42 LAB
==============================

WHAT THIS BUILD DOES
- Replaces the old localhost/local-engine page with a browser-only WebGPU lab.
- No Git, Python, PowerShell, .bat file or localhost server is required by users.
- Actual generation is wired to ai-music-js 0.5.0, which runs ACE-Step 1.5 XL Turbo in a browser Worker with ONNX Runtime Web + WebGPU.
- The first Standard/Turbo model download is approximately 5.63 GB and is cached in browser storage.
- High precision is ~8.00 GB; High-quality planner adds ~4.63 GB; browser AI lyrics add ~0.49 GB.
- Model download starts only after Generate is pressed and the user accepts the storage/device notice.
- Sign-in is requested only when generation actually begins.
- Browser model cache can be cleared from the page.

CURRENT QUALIFIED TARGET
- Current desktop Chrome or Edge
- HTTPS
- WebGPU + hardware acceleration
- Start with 10 seconds, Standard audio, Turbo planner

IMPORTANT LIMITS
- This browser runtime is experimental.
- Do NOT claim Suno 5.5 quality/equivalence until real A/B testing proves it.
- Current runtime supports 10–120 seconds.
- Mobile, Safari and Firefox are not supported by this runtime today.
- Reference audio, cover, repaint, lego/extract, LoRA and full stem/DAW workflows are roadmap items for this browser build, not active features.
- Browser V1 cannot enforce an exact 70% GPU / 50% CPU hardware cap. Balanced reduces workload via standard precision, short default duration and single-job concurrency.

UPLOAD / REPLACE AT REPO ROOT
1) music.html
2) music.css
3) music.js
4) _headers

KEEP EXISTING
- assets/music.svg
- auth-nav.js
- styles.css
- script.js

DELETE OLD LOCAL-ENGINE FILES
See DELETE-OLD-MUSIC-FILES.txt.

SEO / LAUNCH
- music.html intentionally remains noindex,nofollow.
- _headers also sets X-Robots-Tag noindex for /music.
- Do NOT add Music to homepage, sitemap or LUKI live tools yet.
- First prove a real 10-second generation on supported hardware.

THIRD-PARTY RUNTIME / MODEL
- ai-music-js 0.5.0 (MIT source; third-party notices apply)
- ACE-Step 1.5 / XL Turbo model ecosystem
- Browser ONNX conversion is experimental and unofficial relative to the ACE-Step authors.
- Model files are downloaded at runtime from pinned Hugging Face revisions used by ai-music-js.
