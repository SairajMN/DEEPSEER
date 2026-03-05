# Deployment Runbook

1. Bootstrap dependencies.

```bash
pwsh ./scripts/bootstrap.ps1 -InstallFoundryDeps -InstallNodeDeps
```

2. Configure `contracts/.env` from `contracts/.env.example`.

3. Deploy protocol base contracts.

```bash
pwsh ./scripts/deploy-contracts.ps1 -RpcUrl <SEPOLIA_RPC> -PrivateKey <DEPLOYER_PK>
```

4. Update `deploy/sepolia.json` with deployed addresses.

5. Update `cre-workflows/deepseer-settlement/config.json` settlement engine address and chain selector.

6. Configure `cre-workflows/secrets.yaml` and simulate:

```bash
pwsh ./scripts/run-cre-sim.ps1 -Target local-simulation
```

7. Build frontend (existing app routes under `src/`) with chain env:

```bash
cd <repository-root>
npm run build
```
