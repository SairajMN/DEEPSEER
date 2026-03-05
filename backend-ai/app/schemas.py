from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class RiskScoreRequest(BaseModel):
    market_address: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$")
    external_price: str
    external_timestamp: int
    source_payload_hash: str
    source_payload_raw: str | None = None
    deterministic: bool = True

    @field_validator("external_price")
    @classmethod
    def validate_price(cls, value: str) -> str:
        int(value)
        return value


class SourceObservation(BaseModel):
    source: str
    price: int
    timestamp: int


class RiskScoreResponse(BaseModel):
    confidence_score: int = Field(..., ge=0, le=10_000)
    anomaly_flag: bool
    source_consensus: int = Field(..., ge=0, le=10_000)
    evidence_hash: str = Field(..., pattern=r"^0x[a-f0-9]{64}$")
    observations: list[SourceObservation]
