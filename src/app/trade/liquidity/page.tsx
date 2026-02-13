'use client';

import { useState, useCallback } from 'react';
import { useMarketStore, useWalletStore } from '@/store';
import { isConfigured } from '@/lib/config';
import { EmptyState } from '@/components/shared/empty-state';
import { MetricLabel } from '@/components/shared/info-tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseContractError, formatTokenAmount } from '@/lib/contracts';
import { toast } from 'sonner';
import { Loader2, Plus, Minus } from 'lucide-react';

export default function LiquidityPage() {
  const { markets } = useMarketStore();
  const { isConnected } = useWalletStore();
  const [selectedMarket, setSelectedMarket] = useState('');
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [submitting, setSubmitting] = useState(false);

  const market = selectedMarket ? markets.get(selectedMarket) : null;

  const handleSubmit = useCallback(async () => {
    if (!market || !amount || submitting) return;
    setSubmitting(true);
    try {
      const { getSignedAMMContract, parseTokenAmount } = await import('@/lib/contracts');
      const amm = await getSignedAMMContract();
      const parsedAmount = parseTokenAmount(amount);

      let tx;
      if (action === 'add') {
        tx = await amm.addLiquidity(market.id, parsedAmount);
      } else {
        tx = await amm.removeLiquidity(market.id, parsedAmount);
      }
      toast.info('Transaction submitted...');
      await tx.wait();
      toast.success(`Liquidity ${action === 'add' ? 'added' : 'removed'} successfully.`);
      setAmount('');
    } catch (err) {
      toast.error(parseContractError(err));
    } finally {
      setSubmitting(false);
    }
  }, [market, amount, action, submitting]);

  if (!isConfigured()) {
    return <EmptyState type="not-configured" title="Not Configured" description="Set contract addresses to manage liquidity." />;
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Manage Liquidity <MetricLabel label="" term="liquidity" /></CardTitle>
          <p className="text-sm text-muted-foreground">Add or remove liquidity from market pools via the AMM contract.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Market</Label>
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger><SelectValue placeholder="Select market..." /></SelectTrigger>
              <SelectContent>
                {Array.from(markets.values()).filter(m => m.status === 'active').map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.question} — Liq: {formatTokenAmount(m.totalLiquidity)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant={action === 'add' ? 'default' : 'outline'} onClick={() => setAction('add')} className="gap-1">
              <Plus className="h-4 w-4" /> Add
            </Button>
            <Button variant={action === 'remove' ? 'default' : 'outline'} onClick={() => setAction('remove')} className="gap-1">
              <Minus className="h-4 w-4" /> Remove
            </Button>
          </div>

          <div>
            <Label>Amount</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>

          <Button className="w-full" disabled={!isConnected || !amount || !market || submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {!isConnected ? 'Connect Wallet' : `${action === 'add' ? 'Add' : 'Remove'} Liquidity`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
