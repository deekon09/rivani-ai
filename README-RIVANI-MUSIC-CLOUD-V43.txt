RIVANI MUSIC — CLOUD V43

Default route: Instant Cloud
- Calls the public ACE-Step/Ace-Step-v1.5 Hugging Face Gradio Space from the user's browser.
- No multi-GB AI model weights are downloaded to the RIVANI user's device in Cloud mode.
- Provider: external shared Hugging Face ZeroGPU Space.
- Target quality path: ACE-Step 1.5 XL Turbo, 8-step Turbo settings, thinking/planning enabled when exposed by the current API.
- Exact waveform equality with the browser ONNX runtime is NOT guaranteed. Same model family / quality class is the target.
- Queue, provider availability and usage quota can apply.
- Prompt and supplied lyrics are sent to the external provider in Cloud mode.

Fallback route: Private Browser
- Keeps V42 WebGPU generation.
- Standard cold model cache ~5.63 GB; larger options can need more.
- No local installer, Python, Git, PowerShell or localhost service.

Cloud V43 intentionally leaves AI auto-lyrics disabled in Cloud mode. Manual lyrics work; browser-local AI lyric writing remains available in Private Browser. Cloud auto-lyrics is the next integration step using ACE-Step Simple Mode.

Technical notes:
- @gradio/client pinned to 2.5.1.
- Cloud endpoint is discovered at runtime via view_api(), favoring the generation_wrapper / generate_music endpoint.
- CSP allows https://*.hf.space in connect-src and media-src so queue requests and returned audio can work.
- /music remains noindex,nofollow until a real production generation test passes.
