param(
    [string]$EnvFile = ".env.local"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Import-EnvFile {
    param([string]$Path)

    if (!(Test-Path $Path)) {
        throw "Env file not found: $Path"
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
        $value = $parts[1].Trim()
        if ($name.Length -gt 0) {
            Set-Item -Path "Env:$name" -Value $value
        }
    }
}

function Upsert-EnvFile {
    param(
        [string]$Path,
        [hashtable]$Updates
    )

    $existing = @()
    if (Test-Path $Path) {
        $existing = Get-Content $Path
    }

    $seen = @{}
    $next = @()

    foreach ($line in $existing) {
        $match = [regex]::Match($line, "^([A-Za-z_][A-Za-z0-9_]*)=(.*)$")
        if (!$match.Success) {
            $next += $line
            continue
        }

        $name = $match.Groups[1].Value
        if ($Updates.ContainsKey($name)) {
            $next += "$name=$($Updates[$name])"
            $seen[$name] = $true
        } else {
            $next += $line
        }
    }

    foreach ($name in $Updates.Keys) {
        if (!$seen.ContainsKey($name)) {
            $next += "$name=$($Updates[$name])"
        }
    }

    $content = ($next -join "`n").TrimEnd()
    Set-Content -Path $Path -Value "$content`n"
}

function Read-FoundryContracts {
    param([string]$RunLatestPath)

    if (!(Test-Path $RunLatestPath)) {
        throw "run-latest.json not found at: $RunLatestPath"
    }

    $parsed = Get-Content $RunLatestPath -Raw | ConvertFrom-Json
    $contracts = @{}

    foreach ($tx in $parsed.transactions) {
        if ($tx.transactionType -ne "CREATE" -or [string]::IsNullOrWhiteSpace($tx.contractName) -or [string]::IsNullOrWhiteSpace($tx.contractAddress)) {
            continue
        }
        $contracts[$tx.contractName] = $tx.contractAddress
    }

    return @{
        Parsed = $parsed
        Contracts = $contracts
    }
}

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

Import-EnvFile -Path $EnvFile

$required = @("PRIVATE_KEY", "SEPOLIA_RPC_URL", "ETHERSCAN_API_KEY")
foreach ($key in $required) {
    if ([string]::IsNullOrWhiteSpace((Get-Item -Path "Env:$key" -ErrorAction SilentlyContinue).Value)) {
        throw "Missing required env var: $key"
    }
}

& $forgeCommand script script/DeployDeepseer.s.sol:DeployDeepseer `
    --rpc-url $env:SEPOLIA_RPC_URL `
    --broadcast `
    --verify `
    --etherscan-api-key $env:ETHERSCAN_API_KEY `
    -vvvv

if ($LASTEXITCODE -ne 0) {
    throw "forge script failed with exit code $LASTEXITCODE"
}

$runLatestPath = Join-Path (Get-Location) "broadcast/DeployDeepseer.s.sol/11155111/run-latest.json"
$foundryData = Read-FoundryContracts -RunLatestPath $runLatestPath
$contracts = $foundryData.Contracts

$requiredContracts = @("PredictionMarket", "AMM", "SettlementEngine", "Governance", "DeepSeerToken")
foreach ($contractName in $requiredContracts) {
    if ([string]::IsNullOrWhiteSpace($contracts[$contractName])) {
        throw "Missing contract address for $contractName in $runLatestPath"
    }
}

$wsRpcUrl = $env:SEPOLIA_RPC_URL
if ($wsRpcUrl.StartsWith("https://")) {
    $wsRpcUrl = "wss://" + $wsRpcUrl.Substring(8)
}

Upsert-EnvFile -Path $EnvFile -Updates @{
    NEXT_PUBLIC_RPC_URL = $env:SEPOLIA_RPC_URL
    NEXT_PUBLIC_WS_RPC_URL = $wsRpcUrl
    NEXT_PUBLIC_CHAIN_ID = "11155111"
    NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS = $contracts["PredictionMarket"]
    NEXT_PUBLIC_AMM_ADDRESS = $contracts["AMM"]
    NEXT_PUBLIC_SETTLEMENT_ENGINE_ADDRESS = $contracts["SettlementEngine"]
    NEXT_PUBLIC_GOVERNANCE_ADDRESS = $contracts["Governance"]
    NEXT_PUBLIC_TOKEN_ADDRESS = $contracts["DeepSeerToken"]
}

$deployer = ""
foreach ($tx in $foundryData.Parsed.transactions) {
    if ($tx.transaction -and $tx.transaction.from) {
        $deployer = $tx.transaction.from
        break
    }
}

$backendDir = Join-Path (Get-Location) "backend"
New-Item -ItemType Directory -Force -Path $backendDir | Out-Null

$deploymentPayload = @{
    network = "sepolia"
    chainId = "11155111"
    deployedAt = (Get-Date).ToUniversalTime().ToString("o")
    deployer = $deployer
    contracts = @{
        predictionMarket = $contracts["PredictionMarket"]
        amm = $contracts["AMM"]
        settlementEngine = $contracts["SettlementEngine"]
        governance = $contracts["Governance"]
        token = $contracts["DeepSeerToken"]
    }
}

$deploymentPath = Join-Path $backendDir "deployment.json"
$deploymentPayload | ConvertTo-Json -Depth 10 | Set-Content $deploymentPath

Write-Host ""
Write-Host "Deployment broadcast + verification submitted."
Write-Host "Deployment receipts are in $runLatestPath"
Write-Host "Updated env file: $EnvFile"
Write-Host "Updated backend deployment file: $deploymentPath"
