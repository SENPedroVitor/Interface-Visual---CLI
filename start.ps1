# Launcher para o Waddle Agent OS no PowerShell
$venvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
$localVenv = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (Test-Path $localVenv) {
    & $localVenv scripts/start_waddle.py
} elseif (Test-Path $venvPython) {
    & $venvPython scripts/start_waddle.py
} else {
    python scripts/start_waddle.py
}
