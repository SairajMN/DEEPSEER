'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAIRiskStore, useMarketStore } from '@/store';
import { fetchAIRiskExplain, fetchAIRiskTimeline } from '@/lib/api';
import { EmptyState } from '@/components/shared/empty-state';
import { MarketSelector } from '@/components/shared/market-selector';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isConfigured } from '@/lib/config';

interface TimelineEvent {
  type: 'trade' | 'oracle' | 'anomaly';
  timestamp: string;
  details: Record<string, string | number | boolean>;
}

export default function AIRiskTemporalConsistencyPage() {
  const { markets } = useMarketStore();
  const { scores } = useAIRiskStore();
  const [selectedMarket, setSelectedMarket] = useState('');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [volatilityPenalty, setVolatilityPenalty] = useState<number | null>(null);
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
        const [timelineResponse, explain] = await Promise.all([
          fetchAIRiskTimeline(selectedMarket),
          fetchAIRiskExplain(selectedMarket),
        ]);
        if (cancelled) return;
        setTimeline(timelineResponse.timeline as TimelineEvent[]);
        setVolatilityPenalty(explain.metrics.volatilityPenalty);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch temporal consistency');
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
    return <EmptyState type="error" title="Temporal Consistency Unavailable" description={error} />;
  }

  const score = selectedMarket ? scores.get(selectedMarket) ?? null : null;

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Temporal Consistency Graph</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketSelector marketId={selectedMarket} onChange={setSelectedMarket} />
          {!score ? (
            <EmptyState
              type="pending"
              title="Risk model not yet evaluated"
              description="Temporal consistency appears once the AI score exists for this market."
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Consistency</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">{score.temporalConsistency}%</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Volatility Penalty</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">
                    {volatilityPenalty === null ? 'n/a' : `${(volatilityPenalty * 100).toFixed(2)}%`}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Timeline Events</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">{timeline.length}</CardContent>
                </Card>
              </div>

              <div className="max-h-[320px] overflow-y-auto rounded border">
                {timeline.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    Awaiting live trade/oracle event history for this market.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {timeline
                      .slice()
                      .reverse()
                      .map((event, index) => (
                        <li key={`${event.type}-${event.timestamp}-${index}`} className="p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium capitalize">{event.type}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(Number(event.timestamp) * 1000).toISOString()}
                            </span>
                          </div>
                          <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
