RIVANI VIDEO STUDIO V45.7 — HD SOURCE-QUALITY PRESERVE

WHY THIS PATCH EXISTS
The uploaded V45.6 transparent result was technically valid, but ffprobe showed:
- 608 × 1080
- 24 fps
- ~3.33 Mbps

For a typical 1080 × 1920 portrait source, 608 × 1080 means the old "1080p"
logic was shrinking the LONG side to 1080. That throws away a large amount of
camera detail.

V45.7 FIXES

1) ORIENTATION-AWARE HD
720:
- landscape 1280 × 720
- portrait 720 × 1280

Full HD:
- landscape 1920 × 1080
- portrait 1080 × 1920

Original:
- preserves uploaded source resolution by default
- only caps above a 4K-oriented frame box

2) ORIGINAL IS NOW DEFAULT
The export selector defaults to:
Original · preserve source quality

3) NO SILENT MOBILE 720P DOWNGRADE
Transparent export no longer forces mobile to 720p.

4) HIGHER BITRATE
Approx targets:
- Full HD: 14 Mbps
- ~1440p: 22 Mbps
- 4K-ish: 32 Mbps
- ~720p: 9 Mbps

This is intentionally much higher than the previous ~4 Mbps class used by the
608×1080 export.

5) SOURCE-LIKE FPS
Best-effort source frame-rate detection via captureStream track settings.
Fallback is 30 fps. Actual frame timestamps still follow decoded source frames.

6) CAMERA LOOK PRESERVED
Face Studio defaults are now all ZERO:
- Studio Light 0
- Face Smooth 0
- Soft Glow 0
- Clarity 0
- Warmth 0

Background removal should not change the person's skin, sharpness, warmth or
contrast unless the user chooses to.

7) CUTOUT ENGINE UNCHANGED
V45.6 connected-subject matte is preserved.
Native VP9 alpha export is preserved.

VERIFY
Page must show:
V45.7 ENGINE ACTIVE · connected matte + HD source-quality export loaded

TEST
Use a portrait 1080×1920 source:
- choose Original: exported dimensions should remain 1080×1920
- choose Full HD: also 1080×1920
- exported face/shirt should look like the source, without automatic smoothing
- transparent alpha should remain valid
