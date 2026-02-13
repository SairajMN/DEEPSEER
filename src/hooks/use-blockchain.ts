
'use client';

import { useEffect, useCallback } from 'react';
import { useMarketStore, useSelectedMarketStore, useAIRiskStore, useOracleStore } from '@/store';
import { isConfigured } from '@/lib/config';
import { wsClient } from '@/lib/ws/client';
import { fetchLiquidityDepth, fetchPriceHistory } from '@/lib/api';
import type { Market, TradeEvent, AIRiskScore, OracleUpdate, AnomalyFlag, DataSource } from '@/types';

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.floor(value));
  if (typeof value === 'string' && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return BigInt(0);
    }
  }
  return BigInt(0);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseTradePayload(data: unknown): TradeEvent | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;
  if (!payload.marketId || !payload.trader) return null;
  return {
    marketId: String(payload.marketId),
    trader: String(payload.trader),
    outcome: toNumber(payload.outcome),
    side: payload.side === 'sell' ? 'sell' : 'buy',
    amount: toBigInt(payload.amount),
    price: toBigInt(payload.price),
    timestamp: toBigInt(payload.timestamp),
    txHash: String(payload.txHash ?? ''),
  };
}

function parseOraclePayload(data: unknown): OracleUpdate | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;
  if (!payload.marketId) return null;
  return {
    marketId: String(payload.marketId),
    value: toBigInt(payload.value),
    timestamp: toBigInt(payload.timestamp),
    roundId: toBigInt(payload.roundId),
  };
}

function parseRiskPayload(data: unknown): AIRiskScore | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;
  if (!payload.marketId) return null;

  const anomalyFlags: AnomalyFlag[] = Array.isArray(payload.anomalyFlags)
    ? payload.anomalyFlags.map((flag) => {
        const source = flag as Record<string, unknown>;
        const severityRaw = source.severity as AnomalyFlag['severity'] | undefined;
        const severity: AnomalyFlag['severity'] =
          severityRaw === 'low' ||
          severityRaw === 'medium' ||
          severityRaw === 'high' ||
          severityRaw === 'critical'
            ? severityRaw
            : 'low';
        return {
          type: String(source.type ?? 'unknown'),
          severity,
          description: String(source.description ?? ''),
          timestamp: toBigInt(source.timestamp),
        };
      })
    : [];

  const dataSources: DataSource[] = Array.isArray(payload.dataSources)
    ? payload.dataSources.map((source) => {
        const item = source as Record<string, unknown>;
        const statusRaw = item.status as DataSource['status'] | undefined;
        const status: DataSource['status'] =
          statusRaw === 'active' || statusRaw === 'stale' || statusRaw === 'offline'
            ? statusRaw
            : 'offline';
        return {
          name: String(item.name ?? 'unknown'),
          reliability: toNumber(item.reliability),
          lastFetch: toBigInt(item.lastFetch),
          status,
        };
      })
    : [];

  return {
    marketId: String(payload.marketId),
    confidenceScore: toNumber(payload.confidenceScore),
    sourceAgreement: toNumber(payload.sourceAgreement),
    temporalConsistency: toNumber(payload.temporalConsistency),
    anomalyFlags,
    dataSources,
    lastUpdated: toBigInt(payload.lastUpdated),
  };
}

function mapMarketType(value: unknown): Market['marketType'] {
  const index = toNumber(value);
  if (index === 1) return 'scalar';
  if (index === 2) return 'categorical';
  if (index === 3) return 'conditional';
  return 'binary';
}

function mapMarketStatus(value: unknown): Market['status'] {
  const index = toNumber(value);
  if (index === 1) return 'resolving';
  if (index === 2) return 'resolved';
  return 'active';
}

export function useWebSocketSetup() {
  const initialized = Boolean((globalThis as { __deepseerWsInitialized?: boolean }).__deepseerWsInitialized);

  useEffect(() => {
    if (initialized) return;
    (globalThis as { __deepseerWsInitialized?: boolean }).__deepseerWsInitialized = true;

    wsClient.connect();

    const unsubs: (() => void)[] = [];

    unsubs.push(
      wsClient.subscribe('TradeExecuted', (data) => {
        const trade = parseTradePayload(data);
        if (!trade) return;

        useSelectedMarketStore.getState().addTrade(trade);

        const selectedMarketId = useSelectedMarketStore.getState().selectedMarketId;
        if (selectedMarketId && selectedMarketId === trade.marketId) {
          const price = Number(trade.price) / 10000;
          useSelectedMarketStore.getState().addPricePoint({
            time: Number(trade.timestamp),
            open: price,
            high: price,
            low: price,
            close: price,
            volume: Number(trade.amount) / 1e18,
          });
        }
      })
    );

    unsubs.push(
      wsClient.subscribe('MarketResolved', (data) => {
        if (!data || typeof data !== 'object') return;
        const payload = data as Record<string, unknown>;
        const marketId = String(payload.marketId ?? '');
        if (!marketId) return;

        useMarketStore.getState().updateMarket(marketId, {
          status: 'resolved',
          resolved: true,
          winningOutcome: toNumber(payload.winningOutcome),
        });
      })
    );

    unsubs.push(
      wsClient.subscribe('AIConfidenceUpdated', (data) => {
        const score = parseRiskPayload(data);
        if (!score) return;
        useAIRiskStore.getState().setScore(score.marketId, score);
      })
    );

    unsubs.push(
      wsClient.subscribe('OracleUpdated', (data) => {
        const update = parseOraclePayload(data);
        if (!update) return;
        useOracleStore.getState().addUpdate(update);
      })
    );

    unsubs.push(
      wsClient.subscribe('LiquidityAdded', (data) => {
        if (!data || typeof data !== 'object') return;
        const payload = data as Record<string, unknown>;
        const marketId = String(payload.marketId ?? '');
        if (!marketId) return;

        const existing = useMarketStore.getState().markets.get(marketId);
        if (!existing) return;

        useMarketStore.getState().updateMarket(marketId, {
          totalLiquidity: existing.totalLiquidity + toBigInt(payload.amount),
        });
      })
    );

    unsubs.push(
      wsClient.subscribe('LiquidityRemoved', (data) => {
        if (!data || typeof data !== 'object') return;
        const payload = data as Record<string, unknown>;
        const marketId = String(payload.marketId ?? '');
        if (!marketId) return;

        const existing = useMarketStore.getState().markets.get(marketId);
        if (!existing) return;

        const amount = toBigInt(payload.amount);
        useMarketStore.getState().updateMarket(marketId, {
          totalLiquidity: existing.totalLiquidity > amount ? existing.totalLiquidity - amount : BigInt(0),
        });
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [initialized]);
}

export function useContractMarkets() {
  const { setMarkets, setLoading, setError } = useMarketStore();

  const fetchMarkets = useCallback(async () => {
    if (!isConfigured()) {
      setError('Blockchain not configured. Set contract addresses in environment variables.');
      return;
    }

    setLoading(true);
    try {
      const { getPredictionMarketContract, getAMMContract } = await import('@/lib/contracts');
      const pm = getPredictionMarketContract();
      const amm = getAMMContract();

      const count = await pm.getMarketCount();
      const markets: Market[] = [];

      for (let i = 0; i < Number(count); i++) {
        try {
          const raw = await pm.getMarket(i);
          const prices = await amm.getPrices(i);
          markets.push({
            id: i.toString(),
            question: raw.question,
            marketType: mapMarketType(raw.marketType),
            status: mapMarketStatus(raw.status),
            creator: raw.creator,
            createdAt: toBigInt(raw.createdAt),
            resolutionTime: toBigInt(raw.resolutionTime),
            totalLiquidity: toBigInt(raw.totalLiquidity),
            volume: toBigInt(raw.volume),
            outcomes: raw.outcomes,
            outcomePrices: prices.map((p: unknown) => toBigInt(p)),
            oracleSource: raw.oracleSource,
            resolved: raw.resolved,
            winningOutcome: raw.resolved ? toNumber(raw.winningOutcome) : null,
          });
        } catch {
          // Skip individual market errors.
        }
      }

      setMarkets(markets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch markets from contract.');
    }
  }, [setMarkets, setLoading, setError]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { refetch: fetchMarkets };
}
export function useMarketPrices(marketId: string | null) {
  const { setPriceHistory, setLiquidityDepth } = useSelectedMarketStore();

  useEffect(() => {
    if (!marketId || !isConfigured()) return;

    let cancelled = false;

    const fetchLiveMetrics = async () => {
      try {
        const history = await fetchPriceHistory(marketId, 300);
        if (!cancelled) {
          setPriceHistory(history.candles);
        }
      } catch {
        try {
          const { getAMMContract } = await import('@/lib/contracts');
          const amm = getAMMContract();
          const prices = await amm.getPrices(marketId);
          if (!cancelled) {
            const now = Math.floor(Date.now() / 1000);
            const price = Number(prices[0]) / 10000;
            setPriceHistory([
              {
                time: now,
                open: price,
                high: price,
                low: price,
                close: price,
                volume: 0,
              },
            ]);
          }
        } catch {
          if (!cancelled) {
            setPriceHistory([]);
          }
        }
      }

      try {
        const depth = await fetchLiquidityDepth(marketId);
        if (!cancelled) {
          setLiquidityDepth(depth.depth);
        }
      } catch {
        if (!cancelled) {
          setLiquidityDepth([]);
        }
      }
    };

    fetchLiveMetrics();
    const interval = setInterval(fetchLiveMetrics, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [marketId, setLiquidityDepth, setPriceHistory]);
}
