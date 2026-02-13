'use client';

import { MarketList } from '@/components/markets/market-list';

export default function MarketsResolvingPage() {
  return <MarketList filter={(m) => m.status === 'resolving'} />;
}
