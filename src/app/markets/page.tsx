'use client';

import { MarketList } from '@/components/markets/market-list';

export default function MarketsActivePage() {
  return <MarketList filter={(m) => m.status === 'active'} />;
}
