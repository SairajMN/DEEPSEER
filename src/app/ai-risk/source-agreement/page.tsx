'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAIRiskStore, useMarketStore } from '@/store';
import { EmptyState } from '@/components/shared/empty-state';
import { MarketSelector } from '@/components/shared/market-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isConfigured } from '@/lib/config';

export default function AIRiskSourceAgreementPage() {
  const { markets } = useMarketStore();
  const { scores } = useAIRiskStore();
  const [selectedMarket, setSelectedMarket] = useState('');

  const marketList = useMemo(() => Array.from(markets.values()), [markets]);

  useEffect(() => {
    if (!selectedMarket && marketList.length > 0) {
      setSelectedMarket(marketList[0].id);
    }
  }, [marketList, selectedMarket]);

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set contract addresses in environment variables to load AI risk signals."
      />
    );
  }

  const score = selectedMarket ? scores.get(selectedMarket) ?? null : null;

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source Agreement Chart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketSelector marketId={selectedMarket} onChange={setSelectedMarket} />
          {!score ? (
            <EmptyState
              type="pending"
              title="Risk model not yet evaluated"
              description="Source agreement values will appear once AI scoring completes for this market."
            />
          ) : (
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>Aggregate Source Agreement</span>
                  <span>{score.sourceAgreement}%</span>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div className="h-2 rounded bg-blue-500" style={{ width: `${score.sourceAgreement}%` }} />
                </div>
              </div>
              {score.dataSources.map((source) => (
                <div key={source.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="capitalize">{source.name}</span>
                    <span>{source.reliability}%</span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div className="h-2 rounded bg-emerald-500" style={{ width: `${source.reliability}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Status: {source.status} | Last fetch:{' '}
                    {source.lastFetch > BigInt(0)
                      ? new Date(Number(source.lastFetch) * 1000).toISOString()
                      : 'n/a'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
