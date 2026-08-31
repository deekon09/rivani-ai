# RIVANI AI V24.1 — Adaptive Performance

This replaces V24's fixed CPU-throttling schedule with automatic device-aware
scheduling.

## Audio quality is locked

Unchanged:
- Clear Voice model and stable single-thread full-WASM runtime
- Clear Voice model strength / mask / FFT / OLA / Artifact Guard math
- Music Control UVR-MDX-NET-Voc_FT model and reconstruction
- Background Voices separation math
- De-Reverb WPE constants and audio math
- Fan / Traffic / Click behavior
- V23.9 final loudness calibration

Only scheduling / idle gaps change.

## Automatic modes

FAST
- desktop/laptop
- 8+ logical CPU cores
- not mobile / not known low-memory
- much less frequent event-loop yielding
- much shorter inter-chunk pauses

BALANCED
- desktop/laptop with 6+ cores
- moderate cooperative yielding

COOL
- mobile, <=4 cores, or <=4 GB reported memory
- stronger yielding to reduce sustained CPU/thermal pressure

No setting is shown to the user; it is automatic.

## WASM threading safety

Clear Voice always remains single-thread because that is the approved stable
baseline after the previous 50%/PREPARING regression.

Music and Background may use 2 threads ONLY when:
- device is FAST class, AND
- the browser context is already crossOriginIsolated

V24.1 does NOT enable COOP/COEP or SharedArrayBuffer itself, so it cannot
reintroduce the old isolation change just for speed.

In the current non-isolated RIVANI deployment these specialists remain
single-thread, with speed recovered mainly by adaptive removal of unnecessary
fixed pauses on strong computers.

## Product cleanup from V24 remains

- Pro locks restored
- Test Mode / Testing / Beta labels removed
- Free 5 jobs/day UX enforcement enabled
- latest worker cache-busting
- decorative RIVANI animations static
- functional processing/recording animation retained

## Cloudflare

No model Worker update is required.
