#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"; cd "$ROOT"
command -v uv >/dev/null || { echo "uv not found. Run install_linux_macos.sh first."; exit 1; }
uv run python rivani_music_engine.py
