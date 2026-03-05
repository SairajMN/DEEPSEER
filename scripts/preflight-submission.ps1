param(
  [string]$Root = "."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-RepoPath {
  param([string]$Base, [string]$RelativePath)
  return [System.IO.Path]::GetFullPath((Join-Path $Base $RelativePath))
}

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

function Is-NonEmpty {
  param([string]$Value)
  return $null -ne $Value -and $Value.Trim().Length -gt 0
}

function Is-NonZeroAddress {
  param([string]$Value)
  if (!(Is-NonEmpty $Value)) {
    return $false
  }
  if ($Value -notmatch '^0x[a-fA-F0-9]{40}$') {
    return $false
  }
  return $Value.ToLowerInvariant() -ne "0x0000000000000000000000000000000000000000"
}

function Pass {
  param([string]$Message)
  Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Warn {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Fail {
  param([string]$Message)
  Write-Host "[FAIL] $Message" -ForegroundColor Red
}

$repoRoot = Resolve-RepoPath -Base (Get-Location).Path -RelativePath $Root

$contractsEnvPath = Resolve-RepoPath -Base $repoRoot -RelativePath "contracts/.env"
$creEnvPath = Resolve-RepoPath -Base $repoRoot -RelativePath "cre-workflows/.env"
$creSecretsPath = Resolve-RepoPath -Base $repoRoot -RelativePath "cre-workflows/secrets.yaml"
$creConfigPath = Resolve-RepoPath -Base $repoRoot -RelativePath "cre-workflows/deepseer-settlement/config.json"
$deploySepoliaPath = Resolve-RepoPath -Base $repoRoot -RelativePath "deploy/sepolia.json"
$readmePath = Resolve-RepoPath -Base $repoRoot -RelativePath "README.md"

$failures = 0
$warnings = 0

if (Test-Path $contractsEnvPath) {
  Pass "contracts/.env exists"
} else {
  Fail "Missing contracts/.env"
  $failures += 1
}

if (Test-Path $creEnvPath) {
  Pass "cre-workflows/.env exists"
} else {
  Fail "Missing cre-workflows/.env (copy from cre-workflows/.env.example)"
  $failures += 1
}

if (Test-Path $creSecretsPath) {
  Pass "cre-workflows/secrets.yaml exists"
} else {
  Fail "Missing cre-workflows/secrets.yaml (copy from cre-workflows/secrets.yaml.example)"
  $failures += 1
}

if (Test-Path $creConfigPath) {
  Pass "CRE workflow config exists"
} else {
  Fail "Missing CRE workflow config: cre-workflows/deepseer-settlement/config.json"
  $failures += 1
}

if (Test-Path $readmePath) {
  Pass "README.md exists"
} else {
  Fail "Missing README.md"
  $failures += 1
}

$contractsEnv = Load-EnvMap -Path $contractsEnvPath
$creEnv = Load-EnvMap -Path $creEnvPath

$contractsRequired = @(
  "RPC_URL",
  "FUNCTIONS_ROUTER",
  "CRE_FORWARDER",
  "FUNCTIONS_DON_ID",
  "FUNCTIONS_SUBSCRIPTION_ID",
  "MARKET_PRICE_FEED"
)

foreach ($key in $contractsRequired) {
  $value = $contractsEnv[$key]
  if (Is-NonEmpty $value) {
    Pass "contracts/.env -> $key is set"
  } else {
    Fail "contracts/.env -> $key is empty"
    $failures += 1
  }
}

$functionsSourceInline = [string]$contractsEnv["FUNCTIONS_SOURCE"]
$functionsSourceFile = [string]$contractsEnv["FUNCTIONS_SOURCE_FILE"]

if (Is-NonEmpty $functionsSourceInline) {
  Pass "contracts/.env -> FUNCTIONS_SOURCE is set"
} elseif (Is-NonEmpty $functionsSourceFile) {
  $functionsSourceFileNormalized = $functionsSourceFile.Trim().Trim("'", '"')
  $contractsDir = Split-Path -Parent $contractsEnvPath
  $candidatePath = $functionsSourceFileNormalized

  if (!(Test-Path $candidatePath)) {
    $candidatePath = Join-Path $contractsDir $functionsSourceFileNormalized
  }

  if (Test-Path $candidatePath) {
    $sourceFileBody = Get-Content -Path $candidatePath -Raw
    if (Is-NonEmpty $sourceFileBody) {
      Pass "contracts/.env -> FUNCTIONS_SOURCE_FILE points to a non-empty file"
    } else {
      Fail "contracts/.env -> FUNCTIONS_SOURCE_FILE file is empty: $candidatePath"
      $failures += 1
    }
  } else {
    Fail "contracts/.env -> FUNCTIONS_SOURCE_FILE does not exist: $functionsSourceFileNormalized"
    $failures += 1
  }
} else {
  Fail "contracts/.env -> set FUNCTIONS_SOURCE or FUNCTIONS_SOURCE_FILE"
  $failures += 1
}

$workflowId = $contractsEnv["EXPECTED_WORKFLOW_ID"]
if (Is-NonEmpty $workflowId -and $workflowId -match '^0x[a-fA-F0-9]{64}$') {
  if ($workflowId.ToLowerInvariant() -eq "0x0000000000000000000000000000000000000000000000000000000000000000") {
    Warn "EXPECTED_WORKFLOW_ID is zeroed; strict metadata validation is effectively disabled"
    $warnings += 1
  } else {
    Pass "EXPECTED_WORKFLOW_ID is set to a non-zero value"
  }
} else {
  Warn "EXPECTED_WORKFLOW_ID is missing or not a 32-byte hex value"
  $warnings += 1
}

$creRequired = @(
  "RPC_URL",
  "WORKFLOW_OWNER_ADDRESS"
)

foreach ($key in $creRequired) {
  $value = $creEnv[$key]
  if (Is-NonEmpty $value) {
    Pass "cre-workflows/.env -> $key is set"
  } else {
    Fail "cre-workflows/.env -> $key is empty"
    $failures += 1
  }
}

$creRiskApiKey = $creEnv["RISK_API_KEY"]
if (Is-NonEmpty $creRiskApiKey) {
  Pass "cre-workflows/.env -> RISK_API_KEY is set"
} else {
  Warn 'cre-workflows/.env -> RISK_API_KEY is empty (required if secrets.yaml references ${RISK_API_KEY})'
  $warnings += 1
}

if (Test-Path $creConfigPath) {
  $config = Get-Content $creConfigPath -Raw | ConvertFrom-Json
  $settlement = [string]$config.evm.settlementEngineAddress
  if (Is-NonZeroAddress $settlement) {
    Pass "CRE settlementEngineAddress is non-zero: $settlement"
  } else {
    Fail "CRE settlementEngineAddress is zero or invalid in config.json"
    $failures += 1
  }
}

if (Test-Path $deploySepoliaPath) {
  $deploy = Get-Content $deploySepoliaPath -Raw | ConvertFrom-Json
  $deployedEngine = [string]$deploy.contracts.settlementEngine
  if (Is-NonZeroAddress $deployedEngine) {
    Pass "deploy/sepolia.json settlementEngine is set"
    if (Test-Path $creConfigPath) {
      $configEngine = [string]((Get-Content $creConfigPath -Raw | ConvertFrom-Json).evm.settlementEngineAddress)
      if ($configEngine.ToLowerInvariant() -eq $deployedEngine.ToLowerInvariant()) {
        Pass "CRE config settlementEngineAddress matches deploy/sepolia.json"
      } else {
        Warn "CRE config settlementEngineAddress does not match deploy/sepolia.json"
        $warnings += 1
      }
    }
  } else {
    Warn "deploy/sepolia.json settlementEngine is missing or zero"
    $warnings += 1
  }
} else {
  Warn "deploy/sepolia.json not found; cannot compare deployed addresses"
  $warnings += 1
}

if (Test-Path $readmePath) {
  $readme = Get-Content $readmePath -Raw

  if ($readme -match "TODO_ADD_PUBLIC_VIDEO_URL") {
    Fail "README still has TODO_ADD_PUBLIC_VIDEO_URL placeholder"
    $failures += 1
  } else {
    Pass "README has public video link filled"
  }

  if ($readme -match "TODO_ADD_PUBLIC_REPO_URL") {
    Fail "README still has TODO_ADD_PUBLIC_REPO_URL placeholder"
    $failures += 1
  } else {
    Pass "README has public source repo link filled"
  }
}

Write-Host ""
if ($failures -eq 0) {
  Write-Host "Submission preflight passed with $warnings warning(s)." -ForegroundColor Green
  exit 0
}

Write-Host "Submission preflight failed: $failures failure(s), $warnings warning(s)." -ForegroundColor Red
exit 1
