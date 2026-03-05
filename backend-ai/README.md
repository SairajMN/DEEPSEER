# DEEPSEER Backend AI Service

Deterministic FastAPI risk-scoring service used by CRE workflow and Chainlink Functions.

## Run Local

```bash
cd backend-ai
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Docker

```bash
docker build -t deepseer-risk-api .
docker run --rm -p 8000:8000 -e RISK_API_KEY=your-key deepseer-risk-api
```

## Endpoint

`POST /v1/risk-score`

Request body:

```json
{
  "market_address": "0x...",
  "external_price": "104500000000",
  "external_timestamp": 1738548600,
  "source_payload_hash": "0x...",
  "source_payload_raw": "...",
  "deterministic": true
}
```

Response body:

```json
{
  "confidence_score": 8123,
  "anomaly_flag": false,
  "source_consensus": 8450,
  "evidence_hash": "0x...",
  "observations": [
    {"source": "coingecko", "price": 104480000000, "timestamp": 1738548590},
    {"source": "binance", "price": 104510000000, "timestamp": 1738548591}
  ]
}
```
