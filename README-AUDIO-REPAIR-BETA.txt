RIVANI AI V9 — Audio Repair Beta

NEW:
- audio-repair.html
- audio-repair.js
- working browser-side audio scan
- Natural / Clean / Studio repair presets
- before / after audio players
- WAV export
- homepage Audio Repair status changed to Beta
- LUKI knowledge updated to describe the current Beta honestly

IMPORTANT:
The current Beta is a real local audio repair pipeline, but it is NOT yet neural denoising.
Next phase: DeepFilterNet/RNNoise WASM integration for stronger speech noise suppression.

DEPLOY:
1. Upload/replace the V9 website files in your GitHub repository root.
2. Deploy normally through Cloudflare.
3. Replace the rivani-account-api Worker code with backend/worker.js only if you want LUKI to immediately know the updated Audio Repair status.
4. Hard refresh the website (Ctrl+F5).
5. Open /audio-repair.html.
