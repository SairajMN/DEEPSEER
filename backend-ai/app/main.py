from __future__ import annotations

import time

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic_settings import BaseSettings, SettingsConfigDict

from .schemas import RiskScoreRequest, RiskScoreResponse, SourceObservation
from .services.scoring import build_score
from .services.sources import fetch_sources


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    risk_api_key: str | None = None


settings = Settings()
app = FastAPI(title="DEEPSEER Risk API", version="1.0.0")


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if settings.risk_api_key is None:
        return
    if x_api_key != settings.risk_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_api_key")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/risk-score", response_model=RiskScoreResponse, dependencies=[Depends(verify_api_key)])
async def risk_score(payload: RiskScoreRequest) -> RiskScoreResponse:
    external_price = int(payload.external_price)

    source_rows = await fetch_sources()
    now_ts = int(time.time())

    result = build_score(
        external_price=external_price,
        external_timestamp=payload.external_timestamp,
        source_payload_hash=payload.source_payload_hash,
        observations=source_rows,
        now_ts=now_ts,
    )

    observations = [
        SourceObservation(source=source, price=price, timestamp=timestamp)
        for source, price, timestamp in source_rows
    ]

    return RiskScoreResponse(
        confidence_score=result.confidence_score,
        anomaly_flag=result.anomaly_flag,
        source_consensus=result.source_consensus,
        evidence_hash=result.evidence_hash,
        observations=observations,
    )
