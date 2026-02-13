'use client';
import { MarketList } from '@/components/markets/market-list';
export default function Page() {
  return <MarketList filter={(m) => m.status === 'resolved'} />;
}
