param(
  [string]$Target = "local-simulation"
)

$ErrorActionPreference = "Stop"

Push-Location cre-workflows
cre workflow simulate deepseer-settlement --target $Target
Pop-Location
