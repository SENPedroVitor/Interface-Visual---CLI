[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$TaskName = 'Waddle Agent OS'
)

$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($null -eq $task) {
    Write-Host "Autostart não encontrado: '$TaskName'"
    exit 0
}

if ($PSCmdlet.ShouldProcess($TaskName, 'remover tarefa agendada')) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Autostart removido: '$TaskName'"
}
