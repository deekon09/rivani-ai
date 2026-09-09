#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"; VENDOR="$ROOT/vendor/ACE-Step-1.5"
echo "RIVANI Music Local Engine installer"
command -v git >/dev/null || { echo "Git is required."; exit 1; }
if ! command -v uv >/dev/null; then curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; fi
if [ ! -d "$VENDOR/.git" ]; then mkdir -p "$(dirname "$VENDOR")"; git clone --depth 1 https://github.com/ace-step/ACE-Step-1.5.git "$VENDOR"; fi
(cd "$VENDOR" && uv sync)
(cd "$ROOT" && uv sync)
echo "Install complete. Models download on first use / Prepare Model."
echo "Run ./start_rivani_music.sh"
