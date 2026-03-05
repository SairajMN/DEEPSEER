from __future__ import annotations

import hashlib
import json
import statistics
from dataclasses import dataclass


@dataclass(frozen=True)
class ScoreResult:
    confidence_score: int
    anomaly_flag: bool
    source_consensus: int
    evidence_hash: str


def _deviation_bps(a: int, b: int) -> int:
    if a == b:
        return 0
    if a == 0:
        return 10_000
    return int(abs(a - b) * 10_000 / abs(a))


def build_score(
    external_price: int,
    external_timestamp: int,
    source_payload_hash: str,
    observations: list[tuple[str, int, int]],
    now_ts: int,
) -> ScoreResult:
    prices = [external_price] + [price for _, price, _ in observations]
    median_price = int(statistics.median(prices))

    max_deviation = max(_deviation_bps(median_price, price) for price in prices)
    freshness_penalty = 0

    # Penalize stale source snapshots above 10 minutes.
    max_age = max(0, now_ts - external_timestamp)
    if max_age > 600:
        freshness_penalty = min(2_500, (max_age - 600) * 2)

    source_consensus = max(0, 10_000 - min(8_500, max_deviation * 4))
    confidence_score = max(0, min(10_000, source_consensus - freshness_penalty))

    anomaly_flag = max_deviation > 250 or confidence_score < 6_000

    evidence_payload = {
        "external_price": external_price,
        "external_timestamp": external_timestamp,
        "source_payload_hash": source_payload_hash,
        "observations": observations,
        "median_price": median_price,
        "max_deviation": max_deviation,
        "confidence_score": confidence_score,
        "source_consensus": source_consensus,
        "anomaly_flag": anomaly_flag,
    }

    digest = hashlib.sha256(json.dumps(evidence_payload, separators=(",", ":"), sort_keys=True).encode("utf-8")).hexdigest()

    return ScoreResult(
        confidence_score=confidence_score,
        anomaly_flag=anomaly_flag,
        source_consensus=source_consensus,
        evidence_hash=f"0x{digest}",
    )
