import { SubTabNav } from '@/components/layout/sub-tab-nav';

const marketTabs = [
  { href: '/markets', label: 'Active' },
  { href: '/markets/resolving', label: 'Resolving' },
  { href: '/markets/resolved', label: 'Resolved' },
  { href: '/markets/high-volatility', label: 'High Volatility' },
  { href: '/markets/high-confidence', label: 'High Confidence' },
];

export default function MarketsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold">Markets</h1>
        <p className="text-sm text-muted-foreground">Browse prediction markets — all data from blockchain.</p>
      </div>
      <SubTabNav tabs={marketTabs} />
      {children}
    </div>
  );
}
