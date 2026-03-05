param(
  [switch]$InstallNodeDeps,
  [switch]$InstallFoundryDeps
)

$ErrorActionPreference = "Stop"

Write-Host "[DEEPSEER] Bootstrapping workspace..."

if ($InstallFoundryDeps) {
  Push-Location contracts
  forge install OpenZeppelin/openzeppelin-contracts --no-commit
  forge install smartcontractkit/chainlink-contracts --no-commit
  forge install foundry-rs/forge-std --no-commit
  Pop-Location
}

if ($InstallNodeDeps) {
  if (Test-Path "package.json") {
    npm install
  } else {
    Write-Host "[DEEPSEER] Root package.json not found. Skipping root npm install."
  }

  if (Test-Path "frontend/package.json") {
    Push-Location frontend
    npm install
    Pop-Location
  }

  Push-Location cre-workflows/deepseer-settlement
  npm install
  Pop-Location
}

Write-Host "[DEEPSEER] Bootstrap complete."
