@echo off
setlocal
cd /d "%~dp0"
where uv >nul 2>&1 || (echo uv not found. Run install_windows.ps1 first.& pause & exit /b 1)
uv run python rivani_music_engine.py
pause
