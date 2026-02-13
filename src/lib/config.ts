import type { ContractConfig } from '@/types';

// Use static NEXT_PUBLIC env references so values are correctly inlined in client bundles.
const env = {
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL ?? '',
  NEXT_PUBLIC_WS_RPC_URL: process.env.NEXT_PUBLIC_WS_RPC_URL ?? '',
  NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID ?? '11155111',
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '',
  NEXT_PUBLIC_WS_API_URL: process.env.NEXT_PUBLIC_WS_API_URL ?? '',
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '',
  NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS: process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS ?? '',
  NEXT_PUBLIC_AMM_ADDRESS: process.env.NEXT_PUBLIC_AMM_ADDRESS ?? '',
  NEXT_PUBLIC_SETTLEMENT_ENGINE_ADDRESS: process.env.NEXT_PUBLIC_SETTLEMENT_ENGINE_ADDRESS ?? '',
  NEXT_PUBLIC_GOVERNANCE_ADDRESS: process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS ?? '',
  NEXT_PUBLIC_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? '',
} as const;

export const config = {
  rpcUrl: env.NEXT_PUBLIC_RPC_URL,
  wsRpcUrl: env.NEXT_PUBLIC_WS_RPC_URL,
  chainId: Number(env.NEXT_PUBLIC_CHAIN_ID),
  apiUrl: env.NEXT_PUBLIC_API_URL,
  wsApiUrl: env.NEXT_PUBLIC_WS_API_URL,
  walletConnectProjectId: env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  contracts: {
    predictionMarket: env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS,
    amm: env.NEXT_PUBLIC_AMM_ADDRESS,
    settlementEngine: env.NEXT_PUBLIC_SETTLEMENT_ENGINE_ADDRESS,
    governance: env.NEXT_PUBLIC_GOVERNANCE_ADDRESS,
    token: env.NEXT_PUBLIC_TOKEN_ADDRESS,
  } as ContractConfig,
} as const;

export function isConfigured(): boolean {
  return !!(
    config.rpcUrl &&
    config.contracts.predictionMarket &&
    config.contracts.amm &&
    config.contracts.settlementEngine
  );
}

export function getMissingConfig(): string[] {
  const missing: string[] = [];
  if (!config.rpcUrl) missing.push('NEXT_PUBLIC_RPC_URL');
  if (!config.contracts.predictionMarket) missing.push('NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS');
  if (!config.contracts.amm) missing.push('NEXT_PUBLIC_AMM_ADDRESS');
  if (!config.contracts.settlementEngine) missing.push('NEXT_PUBLIC_SETTLEMENT_ENGINE_ADDRESS');
  return missing;
}
