'use client';

import { useMemo, useState } from 'react';
import { useWalletStore } from '@/store';
import { parseContractError } from '@/lib/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type MarketKind = 'binary' | 'scalar' | 'categorical' | 'conditional';

const kindToId: Record<MarketKind, number> = {
  binary: 0,
  scalar: 1,
  categorical: 2,
  conditional: 3,
};

interface CreateMarketFormProps {
  kind: MarketKind;
  title: string;
  description: string;
}

export function CreateMarketForm({ kind, title, description }: CreateMarketFormProps) {
  const { isConnected } = useWalletStore();
  const [question, setQuestion] = useState('');
  const [outcomesRaw, setOutcomesRaw] = useState(kind === 'binary' ? 'Yes\nNo' : '');
  const [resolutionTime, setResolutionTime] = useState('');
  const [oracleSource, setOracleSource] = useState('');
  const [initialLiquidity, setInitialLiquidity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsedOutcomes = useMemo(
    () =>
      outcomesRaw
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean),
    [outcomesRaw]
  );

  const isValid =
    question.trim().length > 0 &&
    parsedOutcomes.length > 1 &&
    resolutionTime.trim().length > 0 &&
    oracleSource.trim().length > 0 &&
    initialLiquidity.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const { getSignedPredictionMarketContract, parseTokenAmount } = await import('@/lib/contracts');
      const contract = await getSignedPredictionMarketContract();
      const timestamp = Math.floor(new Date(resolutionTime).getTime() / 1000);
      if (!Number.isFinite(timestamp) || timestamp <= Math.floor(Date.now() / 1000)) {
        throw new Error('Resolution time must be in the future.');
      }

      const liquidity = parseTokenAmount(initialLiquidity);
      const tx = await contract.createMarket(
        question.trim(),
        kindToId[kind],
        parsedOutcomes,
        timestamp,
        oracleSource.trim(),
        liquidity
      );
      toast.info('Create market transaction submitted');
      await tx.wait();
      toast.success('Market created successfully');
      setQuestion('');
      if (kind !== 'binary') setOutcomesRaw('');
      setResolutionTime('');
      setOracleSource('');
      setInitialLiquidity('');
    } catch (err) {
      toast.error(parseContractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Question</Label>
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Will ...?"
          />
        </div>

        <div className="space-y-2">
          <Label>Outcomes (one per line)</Label>
          <Textarea
            value={outcomesRaw}
            onChange={(event) => setOutcomesRaw(event.target.value)}
            className="min-h-28"
          />
        </div>

        <div className="space-y-2">
          <Label>Resolution Time (UTC)</Label>
          <Input
            type="datetime-local"
            value={resolutionTime}
            onChange={(event) => setResolutionTime(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Oracle Source Address</Label>
          <Input
            value={oracleSource}
            onChange={(event) => setOracleSource(event.target.value)}
            placeholder="0x..."
          />
        </div>

        <div className="space-y-2">
          <Label>Initial Liquidity (token units)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={initialLiquidity}
            onChange={(event) => setInitialLiquidity(event.target.value)}
          />
        </div>

        <Button className="w-full" disabled={!isConnected || !isValid || submitting} onClick={handleSubmit}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {!isConnected ? 'Connect Wallet' : 'Create Market'}
        </Button>
      </CardContent>
    </Card>
  );
}
