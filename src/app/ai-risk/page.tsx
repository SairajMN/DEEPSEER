'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAIRiskStore, useMarketStore } from '@/store';
import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { MetricLabel } from '@/components/shared/info-tooltip';
import { MarketSelector } from '@/components/shared/market-selector';
import { ConfidenceMeter } from '@/components/charts/confidence-meter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AIRiskConfidencePage() {
  const { markets } = useMarketStore();
  const { scores, error } = useAIRiskStore();
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

  if (error) {
    return <EmptyState type="error" title="AI Risk Unavailable" description={error} />;
  }

  const score = selectedMarket ? scores.get(selectedMarket) ?? null : null;

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <MetricLabel label="Confidence Score" term="confidence" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketSelector marketId={selectedMarket} onChange={setSelectedMarket} />
          {!selectedMarket ? (
            <EmptyState
              type="pending"
              title="Select a Market"
              description="Choose a market to inspect AI confidence."
            />
          ) : score ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardContent className="pt-6">
                  <ConfidenceMeter score={score.confidenceScore} />
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Source Agreement</p>
                    <p className="text-2xl font-bold">{score.sourceAgreement}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Temporal Consistency</p>
                    <p className="text-2xl font-bold">{score.temporalConsistency}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="text-sm font-medium">
                      {new Date(Number(score.lastUpdated) * 1000).toISOString()}
                    </p>
                  </div>
                  <div className="md:col-span-3">
                    <p className="text-xs text-muted-foreground">Model Summary</p>
                    <p className="text-sm">
                      Confidence is computed from live market entropy, liquidity depth, trade stability,
                      and oracle freshness. No synthetic feeds are used.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <EmptyState
              type="pending"
              title="Risk model not yet evaluated"
              description="The backend has not produced a confidence score for this market yet."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
