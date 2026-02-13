Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$forgeCommand = Get-Command forge -ErrorAction SilentlyContinue
if (!$forgeCommand) {
    $localForge = Join-Path $env:USERPROFILE ".foundry\\bin\\forge.exe"
    if (Test-Path $localForge) {
        $forgeCommand = $localForge
    } else {
        throw "Foundry is not installed. Install it first: https://book.getfoundry.sh/getting-started/installation"
    }
} else {
    $forgeCommand = $forgeCommand.Source
}

& $forgeCommand build
if ($LASTEXITCODE -ne 0) {
    throw "forge build failed with exit code $LASTEXITCODE"
}
