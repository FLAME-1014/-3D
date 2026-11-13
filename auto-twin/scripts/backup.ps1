param(
    [Parameter(Mandatory = $true)][string]$Stage,
    [switch]$Check
)
$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1
$backupScript = Join-Path $PSScriptRoot 'backup.mjs'
$backupArguments = @($backupScript, $Stage)
if ($Check) { $backupArguments += '--check' }
& $nodeCommand.Source @backupArguments
exit $LASTEXITCODE
