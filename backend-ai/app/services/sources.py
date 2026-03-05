from __future__ import annotations

import time
from typing import Any

import httpx


COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true"
BINANCE_URL = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"


class SourceFetchError(RuntimeError):
    pass


async def fetch_coingecko(client: httpx.AsyncClient) -> tuple[int, int]:
    response = await client.get(COINGECKO_URL, timeout=5.0)
    response.raise_for_status()
    data: dict[str, Any] = response.json()

    btc = data.get("bitcoin", {})
    price = btc.get("usd")
    updated_at = btc.get("last_updated_at")

    if not isinstance(price, (float, int)):
        raise SourceFetchError("coingecko price missing")

    if not isinstance(updated_at, (float, int)):
        updated_at = int(time.time())

    return int(round(float(price) * 100_000_000)), int(updated_at)


async def fetch_binance(client: httpx.AsyncClient) -> tuple[int, int]:
    response = await client.get(BINANCE_URL, timeout=5.0)
    response.raise_for_status()
    data: dict[str, Any] = response.json()

    price_raw = data.get("price")
    if not isinstance(price_raw, str):
        raise SourceFetchError("binance price missing")

    return int(round(float(price_raw) * 100_000_000)), int(time.time())


async def fetch_sources() -> list[tuple[str, int, int]]:
    async with httpx.AsyncClient() as client:
        coingecko_price, coingecko_ts = await fetch_coingecko(client)
        binance_price, binance_ts = await fetch_binance(client)

    return [
        ("coingecko", coingecko_price, coingecko_ts),
        ("binance", binance_price, binance_ts),
    ]
