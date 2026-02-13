'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMarketStore, useWalletStore, useUIStore, useSelectedMarketStore } from '@/store';
import { useMarketPrices } from '@/hooks/use-blockchain';
import { isConfigured } from '@/lib/config';
import { parseContractError, formatTokenAmount } from '@/lib/contracts';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { MetricLabel } from '@/components/shared/info-tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PriceChart } from '@/components/charts/price-chart';
import { DepthChart } from '@/components/charts/depth-chart';

export default function TradePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading trade interface...
        </div>
      }
    >
      <TradePageContent />
    </Suspense>
  );
}

function TradePageContent() {
  const searchParams = useSearchParams();
  const marketId = searchParams.get('market');
  const { markets } = useMarketStore();
  const { isConnected } = useWalletStore();
  const { simpleMode } = useUIStore();
  const { priceHistory, recentTrades, liquidityDepth, setSelectedMarket } = useSelectedMarketStore();

  useMarketPrices(marketId);

  useEffect(() => {
    setSelectedMarket(marketId);
    return () => setSelectedMarket(null);
  }, [marketId, setSelectedMarket]);

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [outcome, setOutcome] = useState<number>(0);
  const [amount, setAmount] = useState('');
  const [slippageTolerance, setSlippageTolerance] = useState(1); // percent
  const [submitting, setSubmitting] = useState(false);

  const market = marketId ? markets.get(marketId) : null;

  const handleTrade = useCallback(async () => {
    if (!market || !amount || submitting) return;
    if (!isConnected) {
      toast.error('Connect your wallet to trade.');
      return;
    }

    setSubmitting(true);
    try {
      const { getSignedAMMContract, parseTokenAmount } = await import('@/lib/contracts');
      const amm = await getSignedAMMContract();
      const parsedAmount = parseTokenAmount(amount);
      const maxSlippage = BigInt(Math.floor(slippageTolerance * 100)); // basis points

      let tx;
      if (side === 'buy') {
        tx = await amm.buy(market.id, outcome, parsedAmount, maxSlippage);
      } else {
        tx = await amm.sell(market.id, outcome, parsedAmount, maxSlippage);
      }
      toast.info('Transaction submitted. Waiting for confirmation...');
      await tx.wait();
      toast.success(`${side === 'buy' ? 'Buy' : 'Sell'} order executed successfully.`);
      setAmount('');
    } catch (err) {
      toast.error(parseContractError(err));
    } finally {
      setSubmitting(false);
    }
  }, [market, amount, outcome, side, slippageTolerance, isConnected, submitting]);

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set contract addresses in environment variables to enable trading."
      />
    );
  }

  if (!marketId || !market) {
    return (
      <div className="p-4">
        <EmptyState
          type="no-data"
          title="Select a Market"
          description="Choose a market from the Markets tab to start trading."
        />
        {/* Market selector */}
        <div className="mt-4 max-w-md mx-auto">
          <Label>Select Market</Label>
          <Select onValueChange={(v) => {
            window.location.href = `/trade?market=${v}`;
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a market..." />
            </SelectTrigger>
            <SelectContent>
              {Array.from(markets.values())
                .filter((m) => m.status === 'active')
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.question}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-4 grid gap-4 lg:grid-cols-3">
        {/* Chart Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Market Info */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{market.question}</CardTitle>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline">{market.marketType}</Badge>
                    <Badge>{market.status}</Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                {market.outcomes.map((o, i) => {
                  const price = market.outcomePrices[i] ? Number(market.outcomePrices[i]) / 10000 : null;
                  return (
                    <div key={i} className="text-center">
                      <p className="text-sm text-muted-foreground">{o}</p>
                      <p className="text-2xl font-bold">
                        {price !== null ? `${(price * 100).toFixed(1)}%` : '—'}
                      </p>
                    </div>
                  );
                })}
                <div className="ml-auto text-right">
                  <MetricLabel label="Volume" term="volume" />
                  <p className="font-bold">{formatTokenAmount(market.volume)}</p>
                </div>
                <div className="text-right">
                  <MetricLabel label="Liquidity" term="liquidity" />
                  <p className="font-bold">{formatTokenAmount(market.totalLiquidity)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Price Chart</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px]">
              <PriceChart data={priceHistory} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Liquidity Curve <MetricLabel label="" term="liquidity" />
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              <DepthChart data={liquidityDepth} />
            </CardContent>
          </Card>

          {/* Recent Trades */}
          {!simpleMode && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Recent Trades</CardTitle>
              </CardHeader>
              <CardContent>
                {recentTrades.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No trades yet. Trades will appear here in real-time via WebSocket.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {recentTrades.map((trade, i) => (
                      <div
                        key={`${trade.txHash}-${i}`}
                        className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          {trade.side === 'buy' ? (
                            <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className="capitalize">{trade.side}</span>
                          <span className="text-muted-foreground">
                            {market.outcomes[trade.outcome] || `Outcome ${trade.outcome}`}
                          </span>
                        </div>
                        <span className="font-mono">{formatTokenAmount(trade.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Trade Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Place Order</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Buy/Sell Toggle */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={side === 'buy' ? 'default' : 'outline'}
                  onClick={() => setSide('buy')}
                  className={side === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  Buy
                </Button>
                <Button
                  variant={side === 'sell' ? 'default' : 'outline'}
                  onClick={() => setSide('sell')}
                  className={side === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  Sell
                </Button>
              </div>

              {/* Outcome Selector */}
              <div>
                <Label>
                  Outcome <MetricLabel label="" term="outcome" />
                </Label>
                <Select value={outcome.toString()} onValueChange={(v) => setOutcome(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {market.outcomes.map((o, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v);
                  }}
                />
              </div>

              {/* Slippage */}
              {!simpleMode && (
                <div>
                  <div className="flex justify-between">
                    <Label>
                      Slippage Tolerance <MetricLabel label="" term="slippage" />
                    </Label>
                    <span className="text-sm text-muted-foreground">{slippageTolerance}%</span>
                  </div>
                  <Slider
                    value={[slippageTolerance]}
                    onValueChange={([v]) => setSlippageTolerance(v)}
                    min={0.1}
                    max={10}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
              )}

              {/* Gas Estimate Info */}
              {!simpleMode && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MetricLabel label="Gas" term="gas" />
                  <span>— estimated on submission</span>
                </div>
              )}

              {/* Submit */}
              <Button
                className="w-full"
                disabled={!amount || !isConnected || submitting || market.status !== 'active'}
                onClick={handleTrade}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {!isConnected
                  ? 'Connect Wallet'
                  : market.status !== 'active'
                  ? 'Market Not Active'
                  : submitting
                  ? 'Submitting...'
                  : `${side === 'buy' ? 'Buy' : 'Sell'} ${market.outcomes[outcome] || ''}`}
              </Button>

              {!isConnected && (
                <p className="text-xs text-yellow-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Connect your wallet to trade.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}
