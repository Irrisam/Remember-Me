# Construit (ou reconstruit) l'environnement de dev Remember Me, hors OneDrive.
# Messages affiches sans accents : PowerShell 5.1 lit ce fichier (UTF-8 sans BOM) en ANSI.
# Usage : powershell -ExecutionPolicy Bypass -File tools\env\setup.ps1 [-Force]
param([switch]$Force)
$ErrorActionPreference = "Stop"

$here = $PSScriptRoot
$root = "$env:LOCALAPPDATA\RememberMe\env"
$nodeVersion = (Get-Content "$here\node-version.txt" -TotalCount 1).Trim()

if ($Force -and (Test-Path $root)) {
    Write-Host "Suppression de l'environnement existant : $root"
    Remove-Item -Recurse -Force $root
}
New-Item -ItemType Directory -Force $root | Out-Null

# 1. venv Python
if (-not (Test-Path "$root\py\Scripts\python.exe")) {
    Write-Host "Creation du venv Python..."
    python -m venv "$root\py"
}
& "$root\py\Scripts\python.exe" -m pip install -q --upgrade pip
& "$root\py\Scripts\python.exe" -m pip install -q -r "$here\requirements.txt"

# 2. Node isolé via nodeenv (réinstallé si la version ne correspond plus)
$nodeExe = "$root\node\Scripts\node.exe"
$current = if (Test-Path $nodeExe) { (& $nodeExe --version).TrimStart("v") } else { $null }
if ($current -ne $nodeVersion) {
    if (Test-Path "$root\node") { Remove-Item -Recurse -Force "$root\node" }
    Write-Host "Installation de Node $nodeVersion..."
    & "$root\py\Scripts\nodeenv.exe" --node=$nodeVersion --prebuilt "$root\node"
}

Write-Host ""
Write-Host "Environnement pret : $root"
Write-Host "  python $(& "$root\py\Scripts\python.exe" --version)"
Write-Host "  node   $(& $nodeExe --version)"
Write-Host "Activer : . tools\env\activate.ps1"
