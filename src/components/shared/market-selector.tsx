'use client';

import { useMemo } from 'react';
import { useMarketStore } from '@/store';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MarketSelectorProps {
  marketId: string;
  onChange: (id: string) => void;
  label?: string;
  includeResolved?: boolean;
}

export function MarketSelector({
  marketId,
  onChange,
  label = 'Market',
  includeResolved = true,
}: MarketSelectorProps) {
  const { markets } = useMarketStore();

  const entries = useMemo(
    () =>
      Array.from(markets.values()).filter((market) => includeResolved || market.status !== 'resolved'),
    [includeResolved, markets]
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={marketId} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select market..." />
        </SelectTrigger>
        <SelectContent>
          {entries.map((market) => (
            <SelectItem key={market.id} value={market.id}>
              {market.question}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
