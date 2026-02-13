'use client';

import { usePortfolioStore, useWalletStore } from '@/store';
import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { MetricLabel } from '@/components/shared/info-tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTokenAmount } from '@/lib/contracts';

export default function MetricsPage() {
  const { positions, metrics } = usePortfolioStore();
  const { isConnected } = useWalletStore();

  if (!isConfigured()) return <EmptyState type="not-configured" title="Not Configured" description="Set contract addresses." />;
  if (!isConnected) return <EmptyState type="no-data" title="Wallet Not Connected" description="Connect your wallet." />;

  // Compute from positions if metrics not loaded from backend
  const totalValue = positions.reduce((acc, p) => acc + p.currentPrice * p.shares / BigInt(10000), BigInt(0));
  const totalPnl = positions.reduce((acc, p) => acc + p.pnl, BigInt(0));
  const winners = positions.filter(p => p.pnl > BigInt(0)).length;
  const winRate = positions.length > 0 ? (winners / positions.length * 100) : 0;

  const items = [
    { label: 'Total Position Value', value: formatTokenAmount(totalValue), term: undefined },
    { label: 'Total P&L', value: `${totalPnl >= BigInt(0) ? '+' : ''}${formatTokenAmount(totalPnl)}`, term: 'pnl' },
    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, term: undefined },
    { label: 'Open Positions', value: positions.length.toString(), term: undefined },
    { label: 'Sharpe Ratio', value: metrics?.sharpeRatio?.toFixed(2) ?? 'Awaiting backend...', term: 'sharpe' },
    { label: 'Max Drawdown', value: metrics?.maxDrawdown !== undefined ? `${(metrics.maxDrawdown * 100).toFixed(1)}%` : 'Awaiting backend...', term: 'drawdown' },
  ];

  return (
    <div className="p-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ label, value, term }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm"><MetricLabel label={label} term={term} /></CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
