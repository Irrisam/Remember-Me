# Active l'environnement dans la session PowerShell courante.
# Usage (avec le point devant) : . tools\env\activate.ps1
$root = "$env:LOCALAPPDATA\RememberMe\env"
if (-not (Test-Path "$root\node\Scripts\node.exe")) {
    Write-Error "Environnement absent. Lancer d'abord : powershell -ExecutionPolicy Bypass -File tools\env\setup.ps1"
    return
}

$env:REMEMBER_ME_ENV = $root
$env:PATH = "$root\node\Scripts;$root\py\Scripts;$env:PATH"
# Paquets npm globaux et cache npm confinés dans l'environnement
$env:npm_config_prefix = "$root\node\Scripts"
$env:npm_config_cache = "$root\npm-cache"

Write-Host "Remember Me env actif : node $(node --version), $(python --version)"
