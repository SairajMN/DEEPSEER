# CRE Workflows

- `project.yaml`: CRE target and RPC config
- `.env.example`: RPC/workflow-owner env template
- `secrets.yaml.example`: secret template
- `deepseer-settlement/`: workflow package

Primary command:

```bash
cp .env.example .env
cp secrets.yaml.example secrets.yaml
cre workflow simulate deepseer-settlement --target local-simulation
```
