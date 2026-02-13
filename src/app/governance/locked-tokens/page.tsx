'use client';

import { useEffect } from 'react';
import { useGovernanceStore, useWalletStore } from '@/store';
import { isConfigured } from '@/lib/config';
import { formatTokenAmount } from '@/lib/contracts';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function GovernanceLockedTokensPage() {
  const { lockedTokens, setLockedTokens, setError, error } = useGovernanceStore();
  const { address, isConnected } = useWalletStore();

  useEffect(() => {
    if (!isConnected || !address || !isConfigured()) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { getGovernanceContract } = await import('@/lib/contracts');
        const governance = getGovernanceContract();
        const amount = await governance.getLockedTokens(address);
        if (!cancelled) setLockedTokens(amount as bigint);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch locked tokens');
      }
    };

    load();
    const interval = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [address, isConnected, setError, setLockedTokens]);

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set contract addresses in environment variables to load governance."
      />
    );
  }

  if (!isConnected || !address) {
    return (
      <EmptyState
        type="no-data"
        title="Wallet Not Connected"
        description="Connect your wallet to view locked tokens."
      />
    );
  }

  if (error) {
    return <EmptyState type="error" title="Locked Tokens Unavailable" description={error} />;
  }

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Locked Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{lockedTokens === null ? '...' : formatTokenAmount(lockedTokens)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Locked balances are sourced directly from governance contract storage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
