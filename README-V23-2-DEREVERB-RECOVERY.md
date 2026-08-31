# RIVANI AI V23.2 — De-Reverb Recovery

This patch fixes the observed `De-Reverb Beta timed out` failure without retuning De-Reverb audio math.

## What changed

- De-Reverb worker now supports a lightweight readiness ping.
- Worker URL is resolved against `import.meta.url`.
- Browser worker-load and message-channel errors are handled immediately instead of waiting 180 seconds.
- If the normal static Worker cannot boot, the same bundled De-Reverb worker source is launched from an embedded Blob recovery worker.
- If processing itself fails, De-Reverb gets one fresh-worker retry.
- The old fixed 180-second timeout is replaced by an inactivity watchdog that refreshes whenever real progress arrives.
- If both De-Reverb attempts fail, De-Reverb safely skips for that job and the stable Clear Voice path continues. The entire enhancement no longer aborts.
- The result label only says `De-Reverb` when De-Reverb actually completed.
- The old misleading Cloudflare model-route error text is removed from De-Reverb failures.

## Audio quality

The WPE-style De-Reverb DSP constants and processing functions are unchanged. Only a `ping` message branch was added to its worker bootstrap.

Clear Voice model/DSP is unchanged from V23.1. Music Control and Background Voices processing are unchanged from V23.1.

## Local benchmark sanity check

The unchanged De-Reverb algorithm processed the supplied ~12.39-second sample in well under one second in the local Node sanity harness. This does not predict every phone/PC speed, but it confirms the three-minute browser timeout was not caused by 10–12 seconds of audio being inherently too long for the De-Reverb math.
