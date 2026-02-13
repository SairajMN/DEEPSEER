'use client';

import { usePortfolioStore, useWalletStore } from '@/store';
import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { MetricLabel } from '@/components/shared/info-tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTokenAmount } from '@/lib/contracts';

export default function PnLPage() {
  const { positions } = usePortfolioStore();
  const { isConnected } = useWalletStore();

  if (!isConfigured()) return <EmptyState type="not-configured" title="Not Configured" description="Set contract addresses." />;
  if (!isConnected) return <EmptyState type="no-data" title="Wallet Not Connected" description="Connect your wallet to view P&L." />;
  if (positions.length === 0) return <EmptyState type="no-data" title="No Positions" description="Trade to see P&L data." />;

  const totalPnl = positions.reduce((acc, p) => acc + p.pnl, BigInt(0));
  const winners = positions.filter(p => p.pnl > BigInt(0)).length;
  const losers = positions.filter(p => p.pnl < BigInt(0)).length;

  return (
    <div className="p-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm"><MetricLabel label="Total P&L" term="pnl" /></CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalPnl >= BigInt(0) ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnl >= BigInt(0) ? '+' : ''}{formatTokenAmount(totalPnl)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Winning Positions</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-500">{winners}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Losing Positions</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-500">{losers}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Position-Level P&L</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {positions.map((pos, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                <span className="text-sm">Market #{pos.marketId} — Outcome {pos.outcome}</span>
                <span className={`font-mono font-bold ${pos.pnl >= BigInt(0) ? 'text-green-500' : 'text-red-500'}`}>
                  {pos.pnl >= BigInt(0) ? '+' : ''}{formatTokenAmount(pos.pnl)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
