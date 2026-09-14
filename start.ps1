# Launcher para o Waddle Agent OS no PowerShell.
# O caminho absoluto permite execução pelo Agendador de Tarefas sem depender
# do diretório de trabalho escolhido pelo Windows.
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '.')).Path
$scriptPath = Join-Path $projectRoot 'scripts\start_waddle.py'
$venvPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
$parentVenvPython = Join-Path (Split-Path $projectRoot -Parent) '.venv\Scripts\python.exe'

Push-Location -LiteralPath $projectRoot
try {
    if (Test-Path -LiteralPath $venvPython) {
        & $venvPython $scriptPath @args
    } elseif (Test-Path -LiteralPath $parentVenvPython) {
        & $parentVenvPython $scriptPath @args
    } else {
        & python $scriptPath @args
    }
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
