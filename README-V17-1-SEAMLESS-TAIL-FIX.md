# RIVANI AI V17.1 — Seamless Tail Fix

V16.2 remains stable backup.
V17 remains the first Studio experiment.

## Exact bug found

The AI engine uses:
- 4 second chunks
- 3 second stride
- therefore 1 second overlap

V17 stitched those chunks by discarding 0.5 s from each side and performing a
hard switch.

For a 4.706 second recording, that hard switch occurs at exactly 3.5 seconds.

The reported issue was:
- voice becomes weaker near the end
- background/noise suddenly returns near the end

The source test also has a naturally quiet section around that time, making a
hard model-context change especially audible.

## V17.1 fix

### Smooth overlap-add

No hard chunk switch.

The full 1 second overlap now uses cosine weighted overlap-add.

### Tail context

The last partial AI chunk is no longer padded with an abrupt long block of
zeros.

It gets reflected recent-audio context for model inference.

Only the real original duration is exported.

### Studio tail protection

Studio Finish is not allowed to boost the high-frequency tail.

### Export integrity

Before creating the downloadable WAV, RIVANI compares the enhanced result with
the original.

If the result is unexpectedly identical / stale, export is blocked instead of
silently giving the original file back under an enhanced filename.

## Test

Use the same `test2.wav`.

Recommended:
- AI Enhancement 85%
- Studio Finish ON

Listen specifically around:
- 3.3–3.8 seconds
- final 0.5 seconds

Then test Studio Finish OFF only if the seam is solved but final tone still
needs comparison.

Do not delete V16.2.
