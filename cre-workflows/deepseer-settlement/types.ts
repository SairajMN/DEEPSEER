import { z } from "zod";

const httpUrlSchema = z
  .string()
  .regex(/^https?:\/\/\S+$/u, "must be a valid http(s) URL");

const evmSchema = z.object({
  chainSelectorName: z.string().min(1),
  settlementEngineAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/u),
  gasLimit: z.string().regex(/^\d+$/u),
});

const externalDataSchema = z.object({
  priceApiUrl: httpUrlSchema,
  assetPath: z.string().min(1),
  timestampPath: z.string().min(1),
  priceScale: z.number().int().positive(),
});

const riskApiSchema = z.object({
  url: httpUrlSchema,
  timeoutMs: z.number().int().positive(),
});

export const configSchema = z.object({
  evm: evmSchema,
  externalData: externalDataSchema,
  riskApi: riskApiSchema,
});

export type Config = z.infer<typeof configSchema>;

export const riskResponseSchema = z.object({
  confidence_score: z.number().int().min(0).max(10_000),
  anomaly_flag: z.boolean(),
  source_consensus: z.number().int().min(0).max(10_000),
  evidence_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/u),
});

export type RiskResponse = z.infer<typeof riskResponseSchema>;

export type ExternalDataResult = {
  externalPrice: bigint;
  externalTimestamp: bigint;
  observationsHash: string;
  rawPayload: string;
};
