import {
  consensusIdenticalAggregation,
  cre,
  ok,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";

import { buildRiskRequestBody, type ExternalDataResult } from "./externalData";
import { riskResponseSchema, type Config, type RiskResponse } from "./types";

const requestRiskScore =
  (config: Config, marketAddress: string, externalData: ExternalDataResult, apiKey: string) =>
  (sendRequester: HTTPSendRequester): RiskResponse => {
    const req = {
      url: config.riskApi.url,
      method: "POST" as const,
      body: buildRiskRequestBody(marketAddress, externalData),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      timeoutMs: config.riskApi.timeoutMs,
      cacheSettings: {
        readFromCache: false,
      },
    };

    const response = sendRequester.sendRequest(req).result();
    const bodyText = new TextDecoder().decode(response.body);
    if (!ok(response)) {
      throw new Error(`Risk API request failed with status ${response.statusCode}: ${bodyText}`);
    }

    return riskResponseSchema.parse(JSON.parse(bodyText));
  };

export function fetchRiskScore(
  runtime: Runtime<Config>,
  marketAddress: string,
  externalData: ExternalDataResult,
): RiskResponse {
  const apiKey = runtime.getSecret({ id: "RISK_API_KEY" }).result().value;
  const httpClient = new cre.capabilities.HTTPClient();

  return httpClient
    .sendRequest(
      runtime,
      requestRiskScore(runtime.config, marketAddress, externalData, apiKey),
      consensusIdenticalAggregation<RiskResponse>(),
    )(runtime.config)
    .result();
}
