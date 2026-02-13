'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMarketStore } from '@/store';
import { EmptyState } from '@/components/shared/empty-state';
import { MetricLabel } from '@/components/shared/info-tooltip';
import { MarketSelector } from '@/components/shared/market-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchGlobalAnalytics, fetchMarketAnalytics } from '@/lib/api';
import { formatTokenAmount } from '@/lib/contracts';
import { isConfigured } from '@/lib/config';

interface GlobalAnalyticsData {
  totalVolume: string;
  totalLiquidity: string;
  totalMarkets: number;
  activeMarkets: number;
  totalTraders: number;
}

interface MarketAnalyticsData {
  volume24h: string;
  volumeTotal: string;
  liquidityTotal: string;
  tradeCount: number;
  uniqueTraders: number;
}

export default function AnalyticsVolumePage() {
  const { markets } = useMarketStore();
  const [selectedMarket, setSelectedMarket] = useState('');
  const [globalAnalytics, setGlobalAnalytics] = useState<GlobalAnalyticsData | null>(null);
  const [marketAnalytics, setMarketAnalytics] = useState<MarketAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const marketList = useMemo(() => Array.from(markets.values()), [markets]);

  useEffect(() => {
    if (!selectedMarket && marketList.length > 0) {
      setSelectedMarket(marketList[0].id);
    }
  }, [marketList, selectedMarket]);

  useEffect(() => {
    if (!isConfigured()) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [globalData, marketData] = await Promise.all([
          fetchGlobalAnalytics(),
          selectedMarket ? fetchMarketAnalytics(selectedMarket) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setGlobalAnalytics(globalData);
        setMarketAnalytics(marketData);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      }
    };

    load();
    const interval = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedMarket]);

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set contract addresses in environment variables to load live analytics."
      />
    );
  }

  if (error) {
    return <EmptyState type="error" title="Analytics Unavailable" description={error} />;
  }

  if (!globalAnalytics) {
    return (
      <EmptyState
        type="pending"
        title="Loading Analytics"
        description="Fetching protocol analytics from blockchain and backend."
      />
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              <MetricLabel label="Total Volume" term="volume" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatTokenAmount(BigInt(globalAnalytics.totalVolume))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              <MetricLabel label="Total Liquidity" term="liquidity" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatTokenAmount(BigInt(globalAnalytics.totalLiquidity))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Markets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{globalAnalytics.totalMarkets}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Markets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{globalAnalytics.activeMarkets}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Unique Traders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{globalAnalytics.totalTraders}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market Volume Detail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketSelector marketId={selectedMarket} onChange={setSelectedMarket} />
          {!selectedMarket || !marketAnalytics ? (
            <EmptyState
              type="pending"
              title="Select a Market"
              description="Choose a market to inspect volume and trader activity."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">24h Volume</CardTitle>
                </CardHeader>
                <CardContent className="font-bold">
                  {formatTokenAmount(BigInt(marketAnalytics.volume24h))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Volume</CardTitle>
                </CardHeader>
                <CardContent className="font-bold">
                  {formatTokenAmount(BigInt(marketAnalytics.volumeTotal))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Liquidity</CardTitle>
                </CardHeader>
                <CardContent className="font-bold">
                  {formatTokenAmount(BigInt(marketAnalytics.liquidityTotal))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Trades</CardTitle>
                </CardHeader>
                <CardContent className="font-bold">{marketAnalytics.tradeCount}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Traders</CardTitle>
                </CardHeader>
                <CardContent className="font-bold">{marketAnalytics.uniqueTraders}</CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
