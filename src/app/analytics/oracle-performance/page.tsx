'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMarketStore } from '@/store';
import { fetchOraclePerformance } from '@/lib/api';
import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { MarketSelector } from '@/components/shared/market-selector';
import { MetricLabel } from '@/components/shared/info-tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OraclePerformance {
  updates: Array<{
    marketId: string;
    value: string;
    roundId: string;
    timestamp: string;
    txHash: string;
  }>;
  updateCount: number;
  lastUpdate: string | null;
  averageIntervalSec: number | null;
  stalenessSec: number | null;
}

export default function AnalyticsOraclePerformancePage() {
  const { markets } = useMarketStore();
  const [selectedMarket, setSelectedMarket] = useState('');
  const [data, setData] = useState<OraclePerformance | null>(null);
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
        const perf = await fetchOraclePerformance(selectedMarket);
        if (cancelled) return;
        setData(perf);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch oracle performance');
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
        description="Set contract addresses in environment variables to load oracle performance."
      />
    );
  }

  if (error) {
    return <EmptyState type="error" title="Oracle Performance Unavailable" description={error} />;
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <MetricLabel label="Oracle Performance" term="oracle" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketSelector marketId={selectedMarket} onChange={setSelectedMarket} />
          {!data ? (
            <EmptyState
              type="pending"
              title="Awaiting oracle update"
              description="No oracle records returned for this market yet."
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Updates</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-bold">{data.updateCount}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Last Update</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs font-mono">
                    {data.lastUpdate ? new Date(Number(data.lastUpdate) * 1000).toISOString() : 'Awaiting'}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Avg Interval</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-medium">
                    {data.averageIntervalSec === null ? 'N/A' : `${data.averageIntervalSec}s`}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Staleness</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-medium">
                    {data.stalenessSec === null ? 'Awaiting oracle update' : `${data.stalenessSec}s`}
                  </CardContent>
                </Card>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Timestamp</th>
                      <th className="pb-2 pr-4">Value</th>
                      <th className="pb-2 pr-4">Round</th>
                      <th className="pb-2 pr-4">Tx Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.updates.length === 0 ? (
                      <tr>
                        <td className="py-4 text-muted-foreground" colSpan={4}>
                          Awaiting oracle update
                        </td>
                      </tr>
                    ) : (
                      data.updates
                        .slice()
                        .reverse()
                        .map((update) => (
                          <tr key={`${update.roundId}-${update.timestamp}`} className="border-b border-border/40">
                            <td className="py-2 pr-4">
                              {new Date(Number(update.timestamp) * 1000).toISOString()}
                            </td>
                            <td className="py-2 pr-4">{update.value}</td>
                            <td className="py-2 pr-4">{update.roundId}</td>
                            <td className="py-2 pr-4 font-mono">
                              {update.txHash ? `${update.txHash.slice(0, 10)}...` : 'n/a'}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
