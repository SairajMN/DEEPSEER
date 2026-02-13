import { SubTabNav } from '@/components/layout/sub-tab-nav';

const tabs = [
  { href: '/governance', label: 'Active Proposals' },
  { href: '/governance/voting-power', label: 'Voting Power' },
  { href: '/governance/locked-tokens', label: 'Locked Tokens' },
  { href: '/governance/history', label: 'Historical Votes' },
];

export default function GovernanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pb-2 pt-4">
        <h1 className="text-2xl font-bold">Governance</h1>
        <p className="text-sm text-muted-foreground">
          Proposals and voting data sourced directly from on-chain governance contracts.
        </p>
      </div>
      <SubTabNav tabs={tabs} />
      {children}
    </div>
  );
}
