'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMarketStore, useSelectedMarketStore } from '@/store';
import { useMarketPrices } from '@/hooks/use-blockchain';
import { EmptyState } from '@/components/shared/empty-state';
import { MarketSelector } from '@/components/shared/market-selector';
import { DepthChart } from '@/components/charts/depth-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isConfigured } from '@/lib/config';

export default function AnalyticsLiquidityDepthPage() {
  const { markets } = useMarketStore();
  const { liquidityDepth } = useSelectedMarketStore();
  const [selectedMarket, setSelectedMarket] = useState('');

  const marketList = useMemo(() => Array.from(markets.values()), [markets]);

  useEffect(() => {
    if (!selectedMarket && marketList.length > 0) {
      setSelectedMarket(marketList[0].id);
    }
  }, [marketList, selectedMarket]);

  useMarketPrices(selectedMarket || null);

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set contract addresses in environment variables to load liquidity depth."
      />
    );
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liquidity Depth</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketSelector marketId={selectedMarket} onChange={setSelectedMarket} />
          {!selectedMarket ? (
            <EmptyState
              type="pending"
              title="Select a Market"
              description="Choose a market to view the AMM depth curve."
            />
          ) : (
            <div className="h-[320px]">
              <DepthChart data={liquidityDepth} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
