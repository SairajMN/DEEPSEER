import {
  consensusIdenticalAggregation,
  cre,
  ok,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";

import { type Config, type ExternalDataResult } from "./types";

function readPath(input: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, input);
}

function toBase64Json(value: unknown): string {
  const bodyBytes = new TextEncoder().encode(JSON.stringify(value));
  return Buffer.from(bodyBytes).toString("base64");
}

const requestPriceData =
  (config: Config) =>
  (sendRequester: HTTPSendRequester): ExternalDataResult => {
    const req = {
      url: config.externalData.priceApiUrl,
      method: "GET" as const,
      headers: {
        "Content-Type": "application/json",
      },
      cacheSettings: {
        readFromCache: true,
        maxAgeMs: 30_000,
      },
    };

    const response = sendRequester.sendRequest(req).result();
    const bodyText = new TextDecoder().decode(response.body);
    if (!ok(response)) {
      throw new Error(`Price API request failed with status ${response.statusCode}: ${bodyText}`);
    }

    const payload = JSON.parse(bodyText);
    const rawPrice = readPath(payload, config.externalData.assetPath);
    const rawTimestamp = readPath(payload, config.externalData.timestampPath);

    if (typeof rawPrice !== "number" || !Number.isFinite(rawPrice)) {
      throw new Error(`Price path not found or invalid: ${config.externalData.assetPath}`);
    }

    const unixTimestamp = typeof rawTimestamp === "number" && Number.isFinite(rawTimestamp)
      ? Math.floor(rawTimestamp)
      : Math.floor(Date.now() / 1000);

    const scaledPrice = BigInt(Math.round(rawPrice * config.externalData.priceScale));
    const digest = `0x${Buffer.from(bodyText).toString("hex")}`;

    return {
      externalPrice: scaledPrice,
      externalTimestamp: BigInt(unixTimestamp),
      observationsHash: digest,
      rawPayload: bodyText,
    };
  };

export function fetchExternalData(runtime: Runtime<Config>): ExternalDataResult {
  const httpClient = new cre.capabilities.HTTPClient();

  return httpClient
    .sendRequest(runtime, requestPriceData(runtime.config), consensusIdenticalAggregation<ExternalDataResult>())(
      runtime.config,
    )
    .result();
}

export function buildRiskRequestBody(
  marketAddress: string,
  externalData: ExternalDataResult,
): string {
  return toBase64Json({
    market_address: marketAddress,
    external_price: externalData.externalPrice.toString(),
    external_timestamp: Number(externalData.externalTimestamp),
    source_payload_hash: externalData.observationsHash,
    source_payload_raw: externalData.rawPayload,
    deterministic: true,
  });
}
