'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMarketStore, useSelectedMarketStore } from '@/store';
import { useMarketPrices } from '@/hooks/use-blockchain';
import { EmptyState } from '@/components/shared/empty-state';
import { MetricLabel } from '@/components/shared/info-tooltip';
import { MarketSelector } from '@/components/shared/market-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PriceChart } from '@/components/charts/price-chart';
import { isConfigured } from '@/lib/config';

function computeVolatility(closes: number[]): number | null {
  if (closes.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] <= 0 || closes[i] <= 0) continue;
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((acc, value) => acc + value, 0) / returns.length;
  const variance = returns.reduce((acc, value) => acc + (value - mean) ** 2, 0) / returns.length;
  return Math.sqrt(Math.max(variance, 0)) * 100;
}

export default function AnalyticsVolatilityPage() {
  const { markets } = useMarketStore();
  const { priceHistory } = useSelectedMarketStore();
  const [selectedMarket, setSelectedMarket] = useState('');

  const marketList = useMemo(() => Array.from(markets.values()), [markets]);

  useEffect(() => {
    if (!selectedMarket && marketList.length > 0) {
      setSelectedMarket(marketList[0].id);
    }
  }, [marketList, selectedMarket]);

  useMarketPrices(selectedMarket || null);

  const volatility = useMemo(
    () => computeVolatility(priceHistory.map((point) => point.close)),
    [priceHistory]
  );

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set contract addresses in environment variables to load volatility."
      />
    );
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <MetricLabel label="Volatility" term="volatility" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketSelector marketId={selectedMarket} onChange={setSelectedMarket} />
          {!selectedMarket ? (
            <EmptyState
              type="pending"
              title="Select a Market"
              description="Choose a market to evaluate realized volatility."
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Realized Volatility</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {volatility === null ? 'Awaiting more trades' : `${volatility.toFixed(2)}%`}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Candles</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">{priceHistory.length}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Status</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-medium">
                    {priceHistory.length === 0 ? 'Awaiting AMM trades' : 'Live'}
                  </CardContent>
                </Card>
              </div>
              <div className="h-[340px]">
                <PriceChart data={priceHistory} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
