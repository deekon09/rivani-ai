# RIVANI AI V22 — Specialist Audio + Microphone

Audio core: stable Clear Voice worker unchanged. De-Reverb worker unchanged.

## Visual
Only the ribbon R and final AI letters of full RIVANI logos receive the colorful sweep. The white RIVANI letters stay static. The homepage dashboard mockup logo stays static.

## Microphone
Upload Audio / Record Microphone source switch. Live timer + level meter. Recorded files enter the same scan/enhance workflow. Free target: 30 min, 500 MB, 5 completed enhancements/day. Pro target: 1 GB/file, 5 h processing/day, unlimited job count. The 5/day lock is counted but not enforced during TEST MODE.

## Specialist order
Music Control -> Background Voices -> De-Reverb -> stable Clear Voice -> Studio Finish.

## Required model-proxy update
Deploy `cloudflare-rivani-models-v22-worker.js` to the existing `rivani-models` Worker before testing the two new specialist models. It adds `/background-voices.onnx` and `/music-vocals.onnx` while keeping the existing Clear Voice route. The Worker streams model bytes only; inference remains browser-side.

## Test separately first
1. Background Voices ON, Music OFF, De-Reverb OFF.
2. Music Control ON, Background Voices OFF, De-Reverb OFF.
3. Then combine with De-Reverb.

No fake fallback is emitted if a specialist engine fails.
