param(
  [string]$ContractsEnvPath = "contracts/.env",
  [string]$DeploySepoliaPath = "deploy/sepolia.json",
  [string]$CreEnvPath = "cre-workflows/.env",
  [string]$CreEnvTemplatePath = "cre-workflows/.env.example",
  [string]$CreConfigPath = "cre-workflows/deepseer-settlement/config.json",
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Load-EnvMap {
  param([string]$Path)

  $map = @{}
  if (!(Test-Path $Path)) {
    return $map
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) {
      return
    }

    $parts = $line.Split("=", 2)
    if ($parts.Count -ne 2) {
      return
    }

    $name = $parts[0].Trim()
    $value = $parts[1]
    if ($name.Length -gt 0) {
      $map[$name] = $value
    }
  }

  return $map
}

function Write-EnvMap {
  param(
    [string]$Path,
    [hashtable]$Map
  )

  $lines = @()
  foreach ($key in ($Map.Keys | Sort-Object)) {
    $lines += "$key=$($Map[$key])"
  }
  Set-Content -Path $Path -Value (($lines -join "`n") + "`n")
}

function Is-NonEmpty {
  param([string]$Value)
  return $null -ne $Value -and $Value.Trim().Length -gt 0
}

if (!(Test-Path $ContractsEnvPath)) {
  throw "Missing contracts env file: $ContractsEnvPath"
}

if (!(Test-Path $CreConfigPath)) {
  throw "Missing CRE config file: $CreConfigPath"
}

if (!(Test-Path $CreEnvPath)) {
  if (Test-Path $CreEnvTemplatePath) {
    Copy-Item -Path $CreEnvTemplatePath -Destination $CreEnvPath
    Write-Host "Created $CreEnvPath from template."
  } else {
    throw "Missing CRE env template: $CreEnvTemplatePath"
  }
}

$contractsEnv = Load-EnvMap -Path $ContractsEnvPath
$creEnv = Load-EnvMap -Path $CreEnvPath

if ($Force -or -not (Is-NonEmpty $creEnv["RPC_URL"])) {
  if (Is-NonEmpty $contractsEnv["RPC_URL"]) {
    $creEnv["RPC_URL"] = $contractsEnv["RPC_URL"]
    Write-Host "Set cre-workflows/.env RPC_URL from contracts/.env."
  }
}

if ($Force -or -not (Is-NonEmpty $creEnv["WORKFLOW_OWNER_ADDRESS"])) {
  $ownerCandidate = $contractsEnv["ADMIN"]
  if (Is-NonEmpty $ownerCandidate) {
    $creEnv["WORKFLOW_OWNER_ADDRESS"] = $ownerCandidate
    Write-Host "Set cre-workflows/.env WORKFLOW_OWNER_ADDRESS from contracts/.env ADMIN."
  }
}

if (-not $creEnv.ContainsKey("RISK_API_KEY")) {
  $creEnv["RISK_API_KEY"] = ""
}

Write-EnvMap -Path $CreEnvPath -Map $creEnv

$targetSettlement = $null
if (Test-Path $DeploySepoliaPath) {
  $deploy = Get-Content $DeploySepoliaPath -Raw | ConvertFrom-Json
  $candidate = [string]$deploy.contracts.settlementEngine
  if (Is-NonEmpty $candidate) {
    $targetSettlement = $candidate
    Write-Host "Using settlementEngine from deploy/sepolia.json."
  }
}

if (-not (Is-NonEmpty $targetSettlement)) {
  $candidate = $contractsEnv["SETTLEMENT_ENGINE_ADDRESS"]
  if (Is-NonEmpty $candidate) {
    $targetSettlement = $candidate
    Write-Host "Using settlementEngine from contracts/.env SETTLEMENT_ENGINE_ADDRESS."
  }
}

if (Is-NonEmpty $targetSettlement) {
  $configObj = Get-Content $CreConfigPath -Raw | ConvertFrom-Json
  $configObj.evm.settlementEngineAddress = $targetSettlement
  $configJson = $configObj | ConvertTo-Json -Depth 10
  Set-Content -Path $CreConfigPath -Value ($configJson + "`n")
  Write-Host "Updated CRE config settlementEngineAddress -> $targetSettlement"
} else {
  Write-Host "No settlement engine address source found. CRE config unchanged." -ForegroundColor Yellow
}

Write-Host "CRE config sync complete."
