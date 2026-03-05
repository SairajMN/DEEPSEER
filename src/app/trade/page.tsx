'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { useMarketPrices } from '@/hooks/use-blockchain';
import { isConfigured } from '@/lib/config';
import { formatTokenAmount, parseContractError } from '@/lib/contracts';
import { useMarketStore, useSelectedMarketStore, useWalletStore } from '@/store';
import { EmptyState } from '@/components/shared/empty-state';
import { WalletButton } from '@/components/wallet/wallet-button';
import { PriceChart } from '@/components/charts/price-chart';

const QUICK_AMOUNTS = ['10', '25', '50', '100'];

function formatTimeWindow(startUnix: number) {
  const start = new Date(startUnix * 1000);
  const end = new Date((startUnix + 300) * 1000);
  const hh = (value: Date) => value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${hh(start)} - ${hh(end)}`;
}

function RoundTimeline() {
  const now = Math.floor(Date.now() / 1000);
  const base = Math.floor(now / 300) * 300;

  const rounds = Array.from({ length: 8 }).map((_, index) => {
    const start = base - (3 - index) * 300;
    const active = start <= now && now < start + 300;
    return {
      id: Math.floor(start / 300),
      label: formatTimeWindow(start),
      active,
      status: start + 300 <= now ? 'closed' : active ? 'active' : 'upcoming',
    };
  });

  return (
    <div className="deepseer-terminal-panel px-4 py-3">
      <p className="deepseer-label">Round Timeline</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {rounds.map((round) => (
          <motion.div
            key={round.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`deepseer-round-chip ${round.active ? 'is-active' : ''}`}
          >
            {round.active ? <span className="deepseer-round-indicator" /> : null}
            <p className="text-xs font-semibold text-slate-100">R{String(round.id).slice(-3)}</p>
            <p className="text-[11px] text-slate-400">{round.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function TradePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const marketId = searchParams.get('market');

  const { markets } = useMarketStore();
  const { selectedMarketId, priceHistory, recentTrades, setSelectedMarket } = useSelectedMarketStore();
  const { isConnected, tokenBalance, balance } = useWalletStore();

  useMarketPrices(marketId);

  useEffect(() => {
    setSelectedMarket(marketId);
    return () => setSelectedMarket(null);
  }, [marketId, setSelectedMarket]);

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [outcome, setOutcome] = useState(0);
  const [amount, setAmount] = useState('25');
  const [slippageTolerance, setSlippageTolerance] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const market = marketId ? markets.get(marketId) : null;

  const bullStrength = useMemo(() => {
    if (priceHistory.length < 2) return 50;
    const first = priceHistory[0].close;
    const last = priceHistory[priceHistory.length - 1].close;
    if (first === 0) return 50;
    return Math.max(0, Math.min(100, 50 + ((last - first) / first) * 500));
  }, [priceHistory]);

  const projectedPayout = useMemo(() => {
    const rawAmount = Number(amount || 0);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0 || !market) return '0.00';

    const selectedPrice = Number(market.outcomePrices[outcome] ?? 0n) / 10_000;
    const multiplier = selectedPrice > 0 ? 1 / selectedPrice : 0;
    return (rawAmount * multiplier).toFixed(2);
  }, [amount, market, outcome]);

  const handleTrade = useCallback(async () => {
    if (!market || !amount || submitting) return;
    if (!isConnected) return;

    setSubmitting(true);
    try {
      const { getSignedAMMContract, parseTokenAmount } = await import('@/lib/contracts');
      const amm = await getSignedAMMContract();
      const parsedAmount = parseTokenAmount(amount);
      const maxSlippage = BigInt(Math.floor(slippageTolerance * 100));

      if (side === 'buy') {
        const tx = await amm.buy(market.id, outcome, parsedAmount, maxSlippage);
        await tx.wait();
      } else {
        const tx = await amm.sell(market.id, outcome, parsedAmount, maxSlippage);
        await tx.wait();
      }

      setAmount('');
    } catch (err) {
      window.alert(parseContractError(err));
    } finally {
      setSubmitting(false);
    }
  }, [market, amount, submitting, isConnected, slippageTolerance, side, outcome]);

  if (!isConfigured()) {
    return (
      <EmptyState
        type="not-configured"
        title="Blockchain Not Configured"
        description="Set contract addresses and RPC settings to enable live DEEPSEER trading."
      />
    );
  }

  if (!marketId || !market) {
    return (
      <div className="px-4 py-6">
        <EmptyState
          type="no-data"
          title="Select A Market"
          description="Pick an active market to open the DEEPSEER terminal."
        />

        <div className="deepseer-terminal-panel mx-auto mt-4 max-w-xl p-4">
          <p className="deepseer-label">Active Markets</p>
          <div className="mt-3 space-y-2">
            {Array.from(markets.values())
              .filter((m) => m.status === 'active')
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-blue-400/70"
                  onClick={() => router.push(`/trade?market=${m.id}`)}
                >
                  {m.question}
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  }

  const totalWinnings = market.volume > market.totalLiquidity ? market.volume - market.totalLiquidity : 0n;
  const winRate = market.volume > 0n ? Math.min(100, (Number(market.totalLiquidity) / Number(market.volume)) * 100) : 0;

  return (
    <div className="deepseer-terminal px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{market.question}</h1>
          <p className="text-xs uppercase tracking-[0.22em] text-blue-300">Real Mode - Chainlink-Secured Settlement</p>
        </div>
        <div className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-200">
          DEMO MODE LABEL (Sandbox)
        </div>
      </div>

      <RoundTimeline />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <motion.div
            className="deepseer-terminal-panel p-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="grid grid-cols-[64px,1fr] gap-4">
              <div className="deepseer-axis-panel">
                <p className="deepseer-label">Strength</p>
                <div className="deepseer-axis-track" />
                <p className="text-[11px] text-emerald-300">Bull {bullStrength.toFixed(1)}%</p>
                <p className="text-[11px] text-rose-300">Bear {(100 - bullStrength).toFixed(1)}%</p>
              </div>

              <div className="rounded-2xl border border-slate-700/75 bg-slate-950/60 p-2">
                <div className="mb-2 flex items-center justify-between px-2">
                  <p className="deepseer-label">Realtime Price</p>
                  <p className="text-xs text-slate-400">Market {selectedMarketId ?? market.id}</p>
                </div>
                <div className="h-[360px]">
                  <PriceChart data={priceHistory} />
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="deepseer-stat-card">
              <p className="deepseer-label">Total Winnings</p>
              <p className="mt-2 text-xl font-semibold text-emerald-300">{formatTokenAmount(totalWinnings)}</p>
            </div>
            <div className="deepseer-stat-card">
              <p className="deepseer-label">Total Staked</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">{formatTokenAmount(market.totalLiquidity)}</p>
            </div>
            <div className="deepseer-stat-card">
              <p className="deepseer-label">Win Rate</p>
              <p className="mt-2 text-xl font-semibold text-blue-300">{winRate.toFixed(1)}%</p>
            </div>
            <div className="deepseer-stat-card">
              <p className="deepseer-label">Open P/L</p>
              <p className="mt-2 flex items-center gap-1 text-xl font-semibold text-slate-100">
                {bullStrength >= 50 ? <TrendingUp className="h-4 w-4 text-emerald-300" /> : <TrendingDown className="h-4 w-4 text-rose-300" />}
                {(bullStrength - 50).toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="deepseer-terminal-panel overflow-hidden">
            <div className="border-b border-slate-700/70 px-4 py-3">
              <p className="deepseer-label">Bets History</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-950/55 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Trader</th>
                    <th className="px-4 py-3 text-left">Side</th>
                    <th className="px-4 py-3 text-left">Outcome</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                        No trades yet for this round.
                      </td>
                    </tr>
                  ) : (
                    recentTrades.slice(0, 10).map((trade, idx) => (
                      <tr key={`${trade.txHash}-${idx}`} className="border-t border-slate-800/80 text-slate-200">
                        <td className="px-4 py-3 font-mono text-xs">{trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 ${trade.side === 'buy' ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {trade.side === 'buy' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                            {trade.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">{market.outcomes[trade.outcome] ?? `Outcome ${trade.outcome}`}</td>
                        <td className="px-4 py-3">{formatTokenAmount(trade.amount)}</td>
                        <td className="px-4 py-3">{(Number(trade.price) / 10000).toFixed(2)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="deepseer-terminal-panel p-4">
            <p className="deepseer-label">Wallet</p>
            <div className="mt-3">
              <WalletButton />
            </div>
            <div className="mt-4 space-y-2 rounded-xl border border-slate-700/75 bg-slate-900/55 p-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Native Balance</span>
                <span className="font-semibold">{balance ? formatTokenAmount(balance) : '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Token Balance</span>
                <span className="font-semibold">{tokenBalance ? formatTokenAmount(tokenBalance) : '—'}</span>
              </div>
            </div>
          </div>

          <motion.div
            className="deepseer-terminal-panel p-4"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <p className="deepseer-label">Bet Panel</p>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/65 p-1">
              <button
                type="button"
                onClick={() => setSide('buy')}
                className={`rounded-xl py-2 text-sm font-semibold transition ${
                  side === 'buy' ? 'deepseer-action-pill' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setSide('sell')}
                className={`rounded-xl py-2 text-sm font-semibold transition ${
                  side === 'sell' ? 'deepseer-action-pill' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Sell
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {market.outcomes.slice(0, 2).map((outcomeLabel, idx) => (
                <button
                  key={outcomeLabel}
                  type="button"
                  onClick={() => setOutcome(idx)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    outcome === idx
                      ? 'border-blue-400/70 bg-blue-500/15 text-blue-200'
                      : 'border-slate-700/80 bg-slate-900/45 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {outcomeLabel}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAmount(quick)}
                  className="rounded-lg border border-slate-700/75 bg-slate-900/50 py-2 text-xs text-slate-300 transition hover:border-blue-400/70"
                >
                  {quick}
                </button>
              ))}
            </div>

            <label className="mt-4 block text-xs uppercase tracking-[0.16em] text-slate-400">
              Custom Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-400/80"
              />
            </label>

            <label className="mt-3 block text-xs uppercase tracking-[0.16em] text-slate-400">
              Slippage ({slippageTolerance.toFixed(1)}%)
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={slippageTolerance}
                onChange={(event) => setSlippageTolerance(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </label>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-700/80 bg-slate-900/55 p-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Projected Payout</span>
                <span className="font-semibold text-blue-300">{projectedPayout}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Protocol Fee</span>
                <span>2.00%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Outcome</span>
                <span>{market.outcomes[outcome] ?? `Outcome ${outcome}`}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={!isConnected || !amount || submitting || market.status !== 'active'}
              onClick={handleTrade}
              className="mt-4 w-full rounded-xl deepseer-action-pill py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </span>
              ) : !isConnected ? (
                'Connect Wallet To Bet'
              ) : market.status !== 'active' ? (
                'Market Not Active'
              ) : (
                `${side === 'buy' ? 'Buy' : 'Sell'} ${market.outcomes[outcome] ?? ''}`
              )}
            </button>

            {!isConnected ? (
              <p className="mt-3 inline-flex items-center gap-1 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Connect your wallet before placing a bet.
              </p>
            ) : null}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-slate-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading DEEPSEER terminal...
        </div>
      }
    >
      <TradePageContent />
    </Suspense>
  );
}
