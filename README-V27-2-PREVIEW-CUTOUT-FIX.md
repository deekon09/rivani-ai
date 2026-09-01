# RIVANI AI V27.2 — Cutout Preview + Background Fix

- Fixed transparent preview: transparent After no longer reveals the Before canvas beneath it.
- Checkerboard exists only in preview; transparent PNG/WebP export remains truly transparent.
- After success, slider opens at 100% After so removal is obvious immediately.
- White/Black/Blur/Gradient/Custom Color/Custom Image backgrounds update immediately.
- Original composite exports no longer copy checkerboard preview.
- Added alpha-mask sanity/orientation guard.
- Choose Image and Remove Another Image use explicit RIVANI gradient styling.
- Auto stays on the tiny U2NetP model. No new Cloudflare model route is required beyond V27.1.
