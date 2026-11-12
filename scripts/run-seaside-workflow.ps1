param([string]$BlenderPath = $env:BLENDER_PATH)
$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
if (-not $BlenderPath) {
    $blenderCommand = Get-Command blender -ErrorAction SilentlyContinue
    if ($blenderCommand) { $BlenderPath = $blenderCommand.Source }
}
if (-not $BlenderPath -and (Test-Path -LiteralPath 'D:\blender.exe')) { $BlenderPath = 'D:\blender.exe' }
if (-not $BlenderPath) {
    $candidates = Get-ChildItem -LiteralPath 'C:\Program Files\Blender Foundation' -Filter blender.exe -Recurse -ErrorAction SilentlyContinue
    $BlenderPath = $candidates | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $BlenderPath -or -not (Test-Path -LiteralPath $BlenderPath)) {
    throw 'Blender executable not found. Pass -BlenderPath or set BLENDER_PATH.'
}
Push-Location -LiteralPath $workspacePath
try {
    & $BlenderPath --background --factory-startup --python-exit-code 1 --python scripts/build_seaside_blender.py
    if ($LASTEXITCODE -ne 0) { throw "Blender build failed: $LASTEXITCODE" }
    node scripts/verify-seaside-workflow.mjs
    if ($LASTEXITCODE -ne 0) { throw "Web verification failed: $LASTEXITCODE" }
    Write-Output 'Build and verification passed. Run npm run dev and open /blender-workflow/.'
} finally {
    Pop-Location
}
