# RIVANI Music — Local Engine V1

This package is the local-device backend and Studio UI for RIVANI Music.

## What it does
- Runs the RIVANI Studio at http://127.0.0.1:43817
- Starts ACE-Step 1.5 locally on http://127.0.0.1:8001
- Detects basic device/RAM/VRAM information and selects a compatible profile
- Supports text-to-music with lyrics, vocal persona prompts, reference audio, BPM, key, time signature, duration, seed lock and variants
- Supports cover, repaint, complete, extract and lego-style track workflows through ACE-Step's local REST API
- Stores project metadata and uploads in local-engine/workspace
- Lets users explicitly prepare/download model checkpoints to their own device

## Install
Windows PowerShell:
1. Right-click PowerShell > Run normally (admin is not required for this package itself).
2. cd into this folder.
3. Run: powershell -ExecutionPolicy Bypass -File .\install_windows.ps1
4. Run start_rivani_music.bat

Linux / macOS:
1. chmod +x install_linux_macos.sh start_rivani_music.sh
2. ./install_linux_macos.sh
3. ./start_rivani_music.sh

## Important storage note
The AI checkpoints are large. The Turbo DiT checkpoint is multiple gigabytes, and optional LM/XL models add more disk usage. Models are cached locally and are not included in this ZIP.

## Voice presets
The bundled 24 RIVANI voice personas are descriptive conditioning presets + deterministic persona seeds. They are not cloned recordings and are not claims of 24 separately trained singer models. For stronger identity consistency, the Studio supports local reference audio when the user confirms rights/consent.

## Privacy / security
- The RIVANI local server binds to 127.0.0.1 only.
- It rejects non-local Host headers.
- Uploaded reference/source audio remains in the local workspace.
- Do not expose ports 43817 or 8001 to the public internet.

## Third-party model
ACE-Step 1.5 is fetched from the official project repository and model source during installation/use. Check the current upstream license and model documentation before redistribution or commercial deployment.

This V1 bundle was built without running functional generation tests, per the project owner's request.

## AMD / Intel notes
ACE-Step upstream ships separate ROCm and Intel/XPU launch/setup scripts. Windows AMD ROCm may require Python 3.12 and the upstream ROCm environment instead of the default CUDA-oriented uv environment. If the RIVANI launcher detects CPU fallback on an AMD/Intel GPU, prepare the upstream ACE-Step ROCm/XPU environment first, then start its local API on 127.0.0.1:8001 before launching RIVANI Music.
