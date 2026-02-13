'use client';

import { MarketList } from '@/components/markets/market-list';
import { useAIRiskStore } from '@/store';

export default function MarketsHighConfidencePage() {
  const { scores } = useAIRiskStore();

  return (
    <MarketList
      filter={(market) => {
        const score = scores.get(market.id);
        return market.status === 'active' && Boolean(score) && (score?.confidenceScore ?? 0) >= 70;
      }}
    />
  );
}
