'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAIRiskStore, useMarketStore } from '@/store';
import { EmptyState } from '@/components/shared/empty-state';
import { MarketSelector } from '@/components/shared/market-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isConfigured } from '@/lib/config';

const severityVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  low: 'outline',
  medium: 'secondary',
  high: 'destructive',
  critical: 'destructive',
};

export default function AIRiskAnomalyFlagsPage() {
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
          <CardTitle className="text-base">Anomaly Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketSelector marketId={selectedMarket} onChange={setSelectedMarket} />
          {!score ? (
            <EmptyState
              type="pending"
              title="Risk model not yet evaluated"
              description="Anomaly flags appear once the AI score exists for this market."
            />
          ) : score.anomalyFlags.length === 0 ? (
            <EmptyState
              type="no-data"
              title="No anomalies detected"
              description="No anomaly markers were generated from current live market data."
            />
          ) : (
            <div className="space-y-3">
              {score.anomalyFlags.map((flag, index) => (
                <div key={`${flag.type}-${index}`} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{flag.type}</div>
                    <Badge variant={severityVariant[flag.severity] ?? 'outline'}>{flag.severity}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{flag.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(Number(flag.timestamp) * 1000).toISOString()}
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
