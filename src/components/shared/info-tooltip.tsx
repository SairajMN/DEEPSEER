'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

const tooltips: Record<string, string> = {
  liquidity: 'Total funds available in the market pool that enable trading. Higher liquidity means less slippage.',
  slippage: 'The difference between expected price and execution price. Larger trades cause more slippage.',
  volatility: 'How much the price moves over time. High volatility means rapid price changes.',
  confidence: 'AI-computed confidence score (0-100) based on data source agreement, temporal consistency, and anomaly detection.',
  volume: 'Total value of trades executed in this market.',
  pnl: 'Profit and Loss — the difference between your position value and what you paid.',
  sharpe: 'Risk-adjusted return. Higher Sharpe ratio means better returns per unit of risk.',
  drawdown: 'Maximum peak-to-trough decline in portfolio value.',
  outcome: 'A possible result for this market (e.g., Yes/No for binary markets).',
  amm: 'Automated Market Maker — an algorithm that provides continuous liquidity and determines prices.',
  oracle: 'External data source (e.g., Chainlink) that provides real-world data for market resolution.',
  settlement: 'The process of determining the winning outcome and distributing payouts.',
  gas: 'Transaction fee paid to the network for processing your transaction.',
};

export function InfoTooltip({ term }: { term: string }) {
  const text = tooltips[term.toLowerCase()];
  if (!text) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="inline h-3.5 w-3.5 ml-1 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function MetricLabel({ label, term }: { label: string; term?: string }) {
  return (
    <span className="text-sm text-muted-foreground flex items-center">
      {label}
      {term && <InfoTooltip term={term} />}
    </span>
  );
}
