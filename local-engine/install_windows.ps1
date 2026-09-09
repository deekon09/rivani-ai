$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Vendor = Join-Path $Root "vendor\ACE-Step-1.5"
Write-Host "RIVANI Music Local Engine installer" -ForegroundColor Cyan
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is required. Install Git for Windows first." }
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Write-Host "Installing uv..."
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}
if (-not (Test-Path $Vendor)) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Vendor) | Out-Null
  git clone --depth 1 https://github.com/ace-step/ACE-Step-1.5.git $Vendor
} else {
  Write-Host "ACE-Step source already present."
}
Write-Host "Preparing ACE-Step environment (first install downloads Python/dependencies)..."
Push-Location $Vendor
uv sync
Pop-Location
Write-Host "Preparing RIVANI local orchestration environment..."
Push-Location $Root
uv sync
Pop-Location
Write-Host "Install complete. Models are downloaded on first use / Prepare Model." -ForegroundColor Green
Write-Host "Run start_rivani_music.bat"
