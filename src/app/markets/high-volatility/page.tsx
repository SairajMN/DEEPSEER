'use client';

import { MarketList } from '@/components/markets/market-list';
import { useAIRiskStore } from '@/store';

export default function MarketsHighVolatilityPage() {
  const { scores } = useAIRiskStore();

  return (
    <MarketList
      filter={(market) => {
        const score = scores.get(market.id);
        return market.status === 'active' && Boolean(score) && (score?.temporalConsistency ?? 100) < 45;
      }}
    />
  );
}
