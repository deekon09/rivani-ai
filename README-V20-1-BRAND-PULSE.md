# RIVANI AI V20.1 — Brand Pulse

Visual-only update based on V20.

## Added

- Every visible exact `RIVANI AI` text phrase receives a restrained moving
  cyan/blue/violet shimmer and glow.
- Dynamic text added after page load is also decorated.
- Header logo keeps the existing breathing aura.
- Footer/auth/dashboard RIVANI logos now receive a softer secondary aura.
- Website background has one slow, smooth blue/violet breathing pulse layer.
- Existing grid pulse is slightly clearer but still slow.
- `prefers-reduced-motion` disables decorative animation.

## Performance

The new motion mostly uses:
- transform
- opacity
- background-position

No canvas/WebGL animation loop is added.

## Audio safety

No audio enhancement code was changed.

Byte-for-byte preserved from V20:
- audio-repair.js
- rivani-ai-worker.js
- mp3-export-worker.js

Only global `script.js`, `styles.css` and cache-version references changed.

Existing Cloudflare model Worker remains unchanged.
