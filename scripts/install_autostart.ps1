[CmdletBinding()]
param(
    [string]$TaskName = 'Waddle Agent OS'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$startScript = Join-Path $projectRoot 'start.ps1'
$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path -LiteralPath $startScript)) {
    throw "Launcher não encontrado: $startScript"
}

$action = New-ScheduledTaskAction `
    -Execute $powerShell `
    -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}" --headless --no-browser' -f $startScript)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
# The ScheduledTasks module exposes this user-session mode as
# `Interactive` (older docs call it InteractiveToken).
$principal = New-ScheduledTaskPrincipal `
    -UserId $userId `
    -LogonType Interactive `
    -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'Inicia o Waddle Agent OS ao entrar no Windows.' `
    -Force | Out-Null

Write-Host "Autostart instalado: '$TaskName' para $userId"
Write-Host 'Para remover: .\scripts\uninstall_autostart.ps1'
