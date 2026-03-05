param(
  [string]$RpcUrl,
  [string]$PrivateKey
)

$ErrorActionPreference = "Stop"

if (-not $RpcUrl -or -not $PrivateKey) {
  throw "RpcUrl and PrivateKey are required"
}

Push-Location contracts

$env:RPC_URL = $RpcUrl
$env:PRIVATE_KEY = $PrivateKey

forge script script/DeployDeepseer.s.sol:DeployDeepseer --rpc-url $env:RPC_URL --broadcast -vvvv

Pop-Location
