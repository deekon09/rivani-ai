# RIVANI AI V23 — Specialist Safety + Performance

Consolidated patch based on real uploaded A/B files.

Music Control:
- catastrophic near-silence guard
- 20 ms speech-retention guard
- protected fallback continues into stable Clear Voice

Background Voices:
- second-speaker evidence gate
- speech-activity gate
- mixture-reconstruction gate
- unsafe-level gate
- Safe Pass when a reliable second speaker is not present
- restrained high-band detail restoration after 16 kHz separation

Fan/Traffic:
- when Music Control or Background Voices is active, neural assist stacking is disabled
- the existing restrained post-cleanup still runs once
- no-specialist Clear Voice behavior remains unchanged

Performance/memory:
- decorative page animations pause during processing and resume after
- toggling a specialist OFF terminates its Worker/session
- low-power/mobile devices automatically reduce decorative GPU load
- low-power/mobile devices release specialist sessions after each job
- strong desktop devices keep WebGPU specialist acceleration
- WASM fallback and V22.1 cross-origin-isolation headers remain

Preserved:
- Clear Voice worker byte-for-byte unchanged from V22.1
- De-Reverb worker byte-for-byte unchanged from V22.1
- logo script unchanged (only R + AI logo animation behavior preserved)
- microphone recording
- test-mode plan locks/limits behavior
- no new Cloudflare model routes required
