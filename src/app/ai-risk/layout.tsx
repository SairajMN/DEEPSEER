import { SubTabNav } from '@/components/layout/sub-tab-nav';

const tabs = [
  { href: '/ai-risk', label: 'Confidence Score' },
  { href: '/ai-risk/source-agreement', label: 'Source Agreement' },
  { href: '/ai-risk/temporal-consistency', label: 'Temporal Consistency' },
  { href: '/ai-risk/anomaly-flags', label: 'Anomaly Flags' },
  { href: '/ai-risk/provenance', label: 'Data Provenance' },
];

export default function AIRiskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pb-2 pt-4">
        <h1 className="text-2xl font-bold">AI Risk</h1>
        <p className="text-sm text-muted-foreground">
          Deterministic risk intelligence from live market, trade, and oracle signals.
        </p>
      </div>
      <SubTabNav tabs={tabs} />
      {children}
    </div>
  );
}
