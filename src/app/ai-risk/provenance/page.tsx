'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAIRiskStore, useMarketStore } from '@/store';
import { fetchAIRiskExplain } from '@/lib/api';
import { EmptyState } from '@/components/shared/empty-state';
import { MarketSelector } from '@/components/shared/market-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isConfigured } from '@/lib/config';

interface ExplainResponse {
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
}

export default function AIRiskProvenancePage() {
  const { markets } = useMarketStore();
  const { scores } = useAIRiskStore();
  const [selectedMarket, setSelectedMarket] = useState('');
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const marketList = useMemo(() => Array.from(markets.values()), [markets]);

  useEffect(() => {
    if (!selectedMarket && marketList.length > 0) {
      setSelectedMarket(marketList[0].id);
    }
  }, [marketList, selectedMarket]);

  useEffect(() => {
    if (!selectedMarket) return;
    let cancelled = false;

    const load = async () => {
      try {
        const response = (await fetchAIRiskExplain(selectedMarket)) as ExplainResponse;
        if (cancelled) return;
        setExplain(response);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch risk provenance');
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
        description="Set contract addresses in environment variables to load AI risk signals."
      />
    );
  }

  if (error) {
    return <EmptyState type="error" title="Data Provenance Unavailable" description={error} />;
  }

  const score = selectedMarket ? scores.get(selectedMarket) ?? null : null;

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Provenance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketSelector marketId={selectedMarket} onChange={setSelectedMarket} />
          {!score || !explain ? (
            <EmptyState
              type="pending"
              title="Risk model not yet evaluated"
              description="Data provenance becomes available after the risk model evaluates this market."
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(explain.metrics).map(([key, value]) => (
                  <Card key={key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm capitalize">{key}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xl font-bold">{(value * 100).toFixed(2)}%</CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Source Records</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {score.dataSources.map((source) => (
                    <div key={source.name} className="rounded border p-2">
                      <div className="font-medium">{source.name}</div>
                      <div className="text-muted-foreground">Status: {source.status}</div>
                      <div className="text-muted-foreground">Reliability: {source.reliability}%</div>
                      <div className="text-muted-foreground">
                        Last fetch:{' '}
                        {source.lastFetch > BigInt(0)
                          ? new Date(Number(source.lastFetch) * 1000).toISOString()
                          : 'n/a'}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
