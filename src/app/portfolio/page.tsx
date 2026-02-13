'use client';

import { usePortfolioStore, useWalletStore, useMarketStore } from '@/store';
import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { MetricLabel } from '@/components/shared/info-tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatTokenAmount } from '@/lib/contracts';
import { Loader2 } from 'lucide-react';

export default function PortfolioPage() {
  const { positions, loading, error } = usePortfolioStore();
  const { isConnected } = useWalletStore();
  const { markets } = useMarketStore();

  if (!isConfigured()) {
    return <EmptyState type="not-configured" title="Not Configured" description="Set contract addresses to view portfolio." />;
  }

  if (!isConnected) {
    return <EmptyState type="no-data" title="Wallet Not Connected" description="Connect your wallet to view your positions." />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading positions from blockchain...</span>
      </div>
    );
  }

  if (error) {
    return <EmptyState type="error" title="Failed to Load Positions" description={error} />;
  }

  if (positions.length === 0) {
    return <EmptyState type="no-data" title="No Open Positions" description="Your positions will appear here after you trade on-chain." />;
  }

  return (
    <div className="p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {positions.map((pos, i) => {
          const market = markets.get(pos.marketId);
          const pnlPositive = pos.pnl >= BigInt(0);
          return (
            <Card key={`${pos.marketId}-${pos.outcome}-${i}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {market?.question || `Market #${pos.marketId}`}
                </CardTitle>
                <Badge variant="outline">{market?.outcomes[pos.outcome] || `Outcome ${pos.outcome}`}</Badge>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <MetricLabel label="Shares" />
                    <p className="font-mono font-bold">{formatTokenAmount(pos.shares)}</p>
                  </div>
                  <div>
                    <MetricLabel label="Avg Price" />
                    <p className="font-mono">{formatTokenAmount(pos.avgPrice, 4)}</p>
                  </div>
                  <div>
                    <MetricLabel label="Current Price" />
                    <p className="font-mono">{formatTokenAmount(pos.currentPrice, 4)}</p>
                  </div>
                  <div>
                    <MetricLabel label="P&L" term="pnl" />
                    <p className={`font-mono font-bold ${pnlPositive ? 'text-green-500' : 'text-red-500'}`}>
                      {pnlPositive ? '+' : ''}{formatTokenAmount(pos.pnl)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
