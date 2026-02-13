import { config } from '@/lib/config';
import type { AIRiskScore } from '@/types';

const API_BASE = config.apiUrl;

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_BASE) {
    throw new Error('API URL not configured (NEXT_PUBLIC_API_URL).');
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAIRiskScore(marketId: string): Promise<AIRiskScore> {
  return apiFetch<AIRiskScore>(`/api/risk/${marketId}`);
}

export async function fetchAIRiskScores(): Promise<AIRiskScore[]> {
  return apiFetch<AIRiskScore[]>('/api/risk');
}

export async function fetchMarketAnalytics(marketId: string) {
  return apiFetch<{
    volume24h: string;
    volumeTotal: string;
    liquidityTotal: string;
    tradeCount: number;
    uniqueTraders: number;
  }>(`/api/analytics/${marketId}`);
}

export async function fetchGlobalAnalytics() {
  return apiFetch<{
    totalVolume: string;
    totalLiquidity: string;
    totalMarkets: number;
    activeMarkets: number;
    totalTraders: number;
  }>('/api/analytics');
}

export async function fetchPriceHistory(marketId: string, intervalSec: number = 300) {
  return apiFetch<{
    marketId: string;
    intervalSec: number;
    candles: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
  }>(`/api/analytics/${marketId}/price-history?intervalSec=${intervalSec}`);
}

export async function fetchLiquidityDepth(marketId: string) {
  return apiFetch<{
    marketId: string;
    depth: Array<{
      price: number;
      buyDepth: number;
      sellDepth: number;
    }>;
  }>(`/api/analytics/${marketId}/depth`);
}

export async function fetchOraclePerformance(marketId: string) {
  return apiFetch<{
    marketId: string;
    updates: Array<{
      marketId: string;
      value: string;
      roundId: string;
      timestamp: string;
      txHash: string;
    }>;
    updateCount: number;
    lastUpdate: string | null;
    averageIntervalSec: number | null;
    stalenessSec: number | null;
  }>(`/api/analytics/${marketId}/oracle-performance`);
}

export async function fetchAIRiskExplain(marketId: string) {
  return apiFetch<{
    marketId: string;
    metrics: {
      entropy: number;
      consensus: number;
      liquidityScore: number;
      volumeScore: number;
      oracleFreshness: number;
      volatilityPenalty: number;
      oracleAgreement: number;
    };
    latestTrade: {
      marketId: string;
      trader: string;
      outcome: number;
      side: 'buy' | 'sell';
      amount: string;
      price: string;
      timestamp: string;
      txHash: string;
    } | null;
    latestOracle: {
      marketId: string;
      value: string;
      roundId: string;
      timestamp: string;
      txHash: string;
    } | null;
    generatedAt: string;
  }>(`/api/risk/${marketId}/explain`);
}

export async function fetchAIRiskTimeline(marketId: string) {
  return apiFetch<{
    marketId: string;
    timeline: Array<{
      type: 'trade' | 'oracle' | 'anomaly';
      timestamp: string;
      details: Record<string, string | number | boolean>;
    }>;
  }>(`/api/risk/${marketId}/timeline`);
}
