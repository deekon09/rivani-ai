# RIVANI AI V26.3 — Precision Suite, Filters, Account Gate

## Image Enhancer

### Free
- 9 completed image enhancements per local calendar day
- only successful enhancement jobs increment the counter
- 10th job is locked until the next day or Pro entitlement
- AI Strength, Clarity, Sharpness, Studio Finish, 1×/2×/4×/8×, Fidelity Guard, Text & Logo Safe, Color Lock
- Free filter panel on the right: Original+, Vivid, Clean, Warm, Cool, Cinema, Mono
- filter strength control
- Smart Photo / PNG / WebP / JPEG export
- drag Before/After comparison remains

### Pro Precision Suite
- Critical Area Lock: up to 5 exact source-anchored regions
- Face Identity Lock: up to 3 face regions; 76% source anchor blend keeps facial geometry stable while retaining restrained enhanced detail
- optional Face Reference Check: local visual descriptor only, no biometric identity claim and no upload
- Logo Reference Lock: up to 3 logo regions restored to the source plus optional local reference descriptor check
- Exact Brand Color Lock: near-matching result colors snap toward a selected HEX color
- Selective Revert Brush: paints parts of an already-enhanced result back to the source and re-encodes without rerunning AI
- QR / Barcode Guard: uses the browser BarcodeDetector when available; source values are checked after enhancement and a lost/mismatched code region is restored from the source. Unsupported browsers tell the user to use Critical Area Lock.
- RIVANI Truth Map
- Print Proof at 300 DPI
- Print-ready fit presets: A4/A3 portrait or landscape at 300 DPI bounds, preserving aspect ratio and avoiding crop
- Batch + Consistency Lock: up to 8 files sequentially, with a captured settings snapshot reapplied before every file

## Account gate
- Image Enhancer requires a signed-in RIVANI account when the user presses Enhance.
- Audio Repair requires a signed-in RIVANI account when the user scans, repairs, or starts microphone recording.
- A reusable `window.RIVANI_REQUIRE_AUTH({tool:"..."})` gate is exposed by `auth-nav.js` for future tools.
- Signup/login links preserve the tool return path through `next=`.
- Firebase custom claims `plan: "pro"` or `pro: true` are read for Pro entitlement.

## Audio
- Existing Free 9/day audio enhancement limit remains.
- Audio usage keys are now scoped to the signed-in Firebase UID on that browser.
- Audio model/DSP/performance pipeline is otherwise unchanged.

## Important production note
The current daily counters are account-scoped in browser localStorage. They work for normal product use but are not a tamper-proof billing boundary. Before paid launch, enforce daily quota and Pro entitlement server-side (for example via a RIVANI account API / database and payment webhook). Client-only controls can always be modified by a determined user because the browser code is public.

## Cloudflare model Worker
No model route change is required for V26.3.
