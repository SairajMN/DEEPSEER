'use client';

import { useEffect, useState } from 'react';
import { useMarketStore, useUIStore } from '@/store';
import { EmptyState } from '@/components/shared/empty-state';
import { MetricLabel } from '@/components/shared/info-tooltip';
import { isConfigured } from '@/lib/config';
import { formatTokenAmount } from '@/lib/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import type { Market } from '@/types';

function MarketCard({ market }: { market: Market }) {
  const { simpleMode } = useUIStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/trade?market=${market.id}`}>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-sm font-medium leading-snug">{market.question}</CardTitle>
              <Badge
                variant={market.status === 'active' ? 'default' : market.status === 'resolving' ? 'secondary' : 'outline'}
              >
                {market.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Outcome Prices */}
            <div className="flex gap-4 mb-3">
              {market.outcomes.map((outcome, i) => {
                const price = market.outcomePrices[i] ? Number(market.outcomePrices[i]) / 10000 : null;
                return (
                  <div key={i} className="flex-1">
                    <p className="text-xs text-muted-foreground">{outcome}</p>
                    <p className="text-lg font-bold">
                      {price !== null ? `${(price * 100).toFixed(1)}%` : '—'}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Metrics */}
            {!simpleMode && (
              <div className="flex gap-4 text-xs border-t pt-2">
                <div>
                  <MetricLabel label="Volume" term="volume" />
                  <p className="font-medium">{formatTokenAmount(market.volume)}</p>
                </div>
                <div>
                  <MetricLabel label="Liquidity" term="liquidity" />
                  <p className="font-medium">{formatTokenAmount(market.totalLiquidity)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium capitalize">{market.marketType}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

export function MarketList({ filter }: { filter?: (m: Market) => boolean }) {
  const { markets, loading, error } = useMarketStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Keep first server render and first client render identical.
  if (!hydrated) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Initializing market view...</span>
      </div>
    );
  }

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set NEXT_PUBLIC_RPC_URL and contract addresses in environment variables to connect to live markets."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading markets from blockchain...</span>
      </div>
    );
  }

  if (error) {
    return <EmptyState type="error" title="Failed to Load Markets" description={error} />;
  }

  const allMarkets = Array.from(markets.values());
  const filtered = filter ? allMarkets.filter(filter) : allMarkets;

  if (filtered.length === 0) {
    return (
      <EmptyState
        type="no-data"
        title="No Markets Found"
        description="No markets match this filter. Markets will appear here once they are created on-chain."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-4">
      {filtered.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}
