import { SubTabNav } from '@/components/layout/sub-tab-nav';

const tabs = [
  { href: '/analytics', label: 'Volume' },
  { href: '/analytics/liquidity-depth', label: 'Liquidity Depth' },
  { href: '/analytics/volatility', label: 'Volatility' },
  { href: '/analytics/fees', label: 'Fee Distribution' },
  { href: '/analytics/oracle-performance', label: 'Oracle Performance' },
];

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground">Protocol-wide analytics from on-chain data.</p>
      </div>
      <SubTabNav tabs={tabs} />
      {children}
    </div>
  );
}
