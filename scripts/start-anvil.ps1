param(
    [int]$Port = 8545,
    [int]$ChainId = 31337
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$anvilCommand = Get-Command anvil -ErrorAction SilentlyContinue
if (!$anvilCommand) {
    $localAnvil = Join-Path $env:USERPROFILE ".foundry\\bin\\anvil.exe"
    if (Test-Path $localAnvil) {
        $anvilCommand = $localAnvil
    } else {
        throw "Foundry is not installed. Install it first: https://book.getfoundry.sh/getting-started/installation"
    }
} else {
    $anvilCommand = $anvilCommand.Source
}

& $anvilCommand --port $Port --chain-id $ChainId
