'use client';

import { usePortfolioStore, useWalletStore, useMarketStore } from '@/store';
import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTokenAmount } from '@/lib/contracts';

export default function ExposurePage() {
  const { positions } = usePortfolioStore();
  const { isConnected } = useWalletStore();
  const { markets } = useMarketStore();

  if (!isConfigured()) return <EmptyState type="not-configured" title="Not Configured" description="Set contract addresses." />;
  if (!isConnected) return <EmptyState type="no-data" title="Wallet Not Connected" description="Connect your wallet." />;
  if (positions.length === 0) return <EmptyState type="no-data" title="No Positions" description="Trade to see exposure data." />;

  // Group by market for heatmap
  const marketExposure = new Map<string, { shares: bigint; value: bigint; market: string }>();
  positions.forEach(p => {
    const existing = marketExposure.get(p.marketId) || { shares: BigInt(0), value: BigInt(0), market: markets.get(p.marketId)?.question || `Market #${p.marketId}` };
    existing.shares += p.shares;
    existing.value += p.currentPrice * p.shares / BigInt(10000);
    marketExposure.set(p.marketId, existing);
  });

  const entries = Array.from(marketExposure.entries());
  const totalValue = entries.reduce((acc, [, v]) => acc + v.value, BigInt(0));

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Exposure Heatmap</CardTitle>
          <p className="text-sm text-muted-foreground">Visualizes portfolio concentration across markets. Larger blocks = higher exposure.</p>
        </CardHeader>
        <CardContent>
          {totalValue === BigInt(0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">Awaiting non-zero position values from AMM...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {entries.map(([id, data]) => {
                const pct = totalValue > BigInt(0) ? Number(data.value * BigInt(100) / totalValue) : 0;
                const intensity = Math.min(pct / 50, 1); // 0-1
                return (
                  <div
                    key={id}
                    className="rounded-lg p-3 border"
                    style={{
                      backgroundColor: `rgba(99, 102, 241, ${0.1 + intensity * 0.5})`,
                      borderColor: `rgba(99, 102, 241, ${0.2 + intensity * 0.3})`,
                    }}
                  >
                    <p className="text-xs font-medium truncate">{data.market}</p>
                    <p className="text-lg font-bold">{pct.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">{formatTokenAmount(data.value)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
