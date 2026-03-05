import { SubTabNav } from '@/components/layout/sub-tab-nav';

const tradeTabs = [
  { href: '/trade', label: 'Buy / Sell' },
  { href: '/trade/limit-orders', label: 'Limit Orders' },
  { href: '/trade/liquidity', label: 'Liquidity' },
  { href: '/trade/order-history', label: 'Order History' },
];

export default function TradeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold">Trade Terminal</h1>
        <p className="text-sm text-muted-foreground">
          Round-based DEEPSEER interface with realtime pricing, bull/bear strength, and on-chain execution.
        </p>
      </div>
      <SubTabNav tabs={tradeTabs} />
      {children}
    </div>
  );
}
