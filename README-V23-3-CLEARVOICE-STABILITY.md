# RIVANI AI V23.3 — Clear Voice Stability Recovery

Root cause of the 50% freeze:
- 50% is the handoff point from optional specialist stages to Clear Voice.
- V22.1 added cross-origin isolation for the speed experiment.
- That enabled threaded ONNX Runtime WASM for the large Clear Voice session.
- The affected browser/device can stall while that session is preparing.

V23.3 restores the proven compatibility baseline:
- Clear Voice full WASM
- forced numThreads = 1
- cross-origin isolation explicitly disabled on /audio-repair*
- same Clear Voice ONNX model
- same Clear Voice DSP / STFT / overlap / output path
- no lower-quality fast mode

Reliability:
- no eager Clear Voice session compile when a file is merely loaded
- worker `error` and `messageerror` are handled
- 90-second inactivity watchdog
- one automatic fresh-worker retry
- no permanent 50% wait
- preparation now gets visible progress range

Preserved:
- V23 Music Control safety guards
- V23 Background Voices safety gates
- De-Reverb V23.2 recovery behavior
- microphone workflow
- performance-mode visual pause/resume
- specialist RAM release behavior

No Cloudflare `rivani-models` Worker change is required.
