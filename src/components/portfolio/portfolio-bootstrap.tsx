'use client';

import { useEffect, useCallback } from 'react';
import { usePortfolioStore, useWalletStore } from '@/store';
import { isConfigured } from '@/lib/config';
import type { Position } from '@/types';

export function PortfolioBootstrap() {
  const { address, isConnected } = useWalletStore();
  const { setPositions, setLoading, setError } = usePortfolioStore();

  const loadPositions = useCallback(async () => {
    if (!isConnected || !address || !isConfigured()) {
      setPositions([]);
      return;
    }

    setLoading(true);
    try {
      const { getPredictionMarketContract, getAMMContract } = await import('@/lib/contracts');
      const pm = getPredictionMarketContract();
      const amm = getAMMContract();
      const rawPositions = await pm.getUserPositions(address);
      const parsed: Position[] = await Promise.all(
        rawPositions.map(
          async (position: {
            marketId: bigint;
            outcome: bigint;
            shares: bigint;
            avgPrice: bigint;
          }) => {
            let currentPrice = BigInt(0);
            try {
              currentPrice = await amm.getPrice(Number(position.marketId), Number(position.outcome));
            } catch {
              currentPrice = BigInt(0);
            }

            const pnl = ((currentPrice - position.avgPrice) * position.shares) / BigInt(10000);
            return {
              marketId: position.marketId.toString(),
              outcome: Number(position.outcome),
              shares: position.shares,
              avgPrice: position.avgPrice,
              currentPrice,
              pnl,
            };
          }
        )
      );

      setPositions(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load positions');
    }
  }, [address, isConnected, setError, setLoading, setPositions]);

  useEffect(() => {
    loadPositions();
    const interval = setInterval(loadPositions, 20_000);
    return () => clearInterval(interval);
  }, [loadPositions]);

  return null;
}
