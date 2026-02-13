'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWalletStore } from '@/store';
import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTokenAmount } from '@/lib/contracts';
import { Loader2 } from 'lucide-react';

interface TradeRow {
  marketId: string;
  outcome: number;
  side: 'buy' | 'sell';
  amount: bigint;
  price: bigint;
  timestamp: bigint;
  txHash: string;
}

export default function OrderHistoryPage() {
  const { address, isConnected } = useWalletStore();
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const { getAMMContract } = await import('@/lib/contracts');
      const amm = getAMMContract();
      const filter = amm.filters.TradeExecuted(null, address);
      const latest = await amm.runner?.provider?.getBlockNumber?.();
      const fromBlock = typeof latest === 'number' ? Math.max(0, latest - 20_000) : 0;
      const logs = await amm.queryFilter(filter, fromBlock, latest);
      const parsed: TradeRow[] = logs
        .filter((log): log is typeof log & { args: Record<string, unknown> } => 'args' in log)
        .map((log) => ({
          marketId: (log.args.marketId ?? log.args[0]).toString(),
          outcome: Number(log.args.outcome ?? log.args[2]),
          side: (Boolean(log.args.isBuy ?? log.args[3]) ? 'buy' : 'sell') as 'buy' | 'sell',
          amount: (log.args.amount ?? log.args[4]) as bigint,
          price: (log.args.price ?? log.args[5]) as bigint,
          timestamp: (log.args.timestamp ?? log.args[6]) as bigint,
          txHash: log.transactionHash,
        }))
        .reverse();
      setRows(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch order history');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 20_000);
    return () => clearInterval(interval);
  }, [loadHistory]);

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Not Configured"
        description="Set contract addresses to view order history."
      />
    );
  }

  if (!isConnected || !address) {
    return (
      <EmptyState
        type="no-data"
        title="Wallet Not Connected"
        description="Connect your wallet to see your on-chain trade history."
      />
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading trade history...
      </div>
    );
  }

  if (error) {
    return <EmptyState type="error" title="Order History Unavailable" description={error} />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        type="no-data"
        title="No trades found"
        description="Your on-chain trades will appear here after executions."
      />
    );
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Timestamp</th>
                  <th className="pb-2 pr-4">Market</th>
                  <th className="pb-2 pr-4">Side</th>
                  <th className="pb-2 pr-4">Outcome</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Price</th>
                  <th className="pb-2 pr-4">Tx</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.txHash}-${index}`} className="border-b border-border/50">
                    <td className="py-2 pr-4">{new Date(Number(row.timestamp) * 1000).toISOString()}</td>
                    <td className="py-2 pr-4">{row.marketId}</td>
                    <td
                      className={`py-2 pr-4 capitalize ${
                        row.side === 'buy' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {row.side}
                    </td>
                    <td className="py-2 pr-4">{row.outcome}</td>
                    <td className="py-2 pr-4 font-mono">{formatTokenAmount(row.amount)}</td>
                    <td className="py-2 pr-4 font-mono">{(Number(row.price) / 10000).toFixed(4)}</td>
                    <td className="py-2 pr-4 font-mono">{`${row.txHash.slice(0, 10)}...`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
