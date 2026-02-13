'use client';

import { useEffect } from 'react';
import { useContractMarkets, useWebSocketSetup } from '@/hooks/use-blockchain';
import { fetchAIRiskScores } from '@/lib/api';
import { useAIRiskStore } from '@/store';

function parseBigInt(value: unknown): bigint {
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

export function LiveDataBootstrap() {
  useWebSocketSetup();
  useContractMarkets();

  const { setScores, setLoading, setError } = useAIRiskStore();

  useEffect(() => {
    let cancelled = false;

    const fetchScores = async () => {
      setLoading(true);
      try {
        const scores = await fetchAIRiskScores();
        if (cancelled) return;
        const parsed = scores.map((score) => ({
          ...score,
          lastUpdated: parseBigInt(score.lastUpdated),
          anomalyFlags: score.anomalyFlags.map((flag) => ({
            ...flag,
            timestamp: parseBigInt(flag.timestamp),
          })),
          dataSources: score.dataSources.map((source) => ({
            ...source,
            lastFetch: parseBigInt(source.lastFetch),
          })),
        }));
        setScores(parsed);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Risk model not yet evaluated');
      }
    };

    fetchScores();
    const interval = setInterval(fetchScores, 20_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setError, setLoading, setScores]);

  return null;
}
