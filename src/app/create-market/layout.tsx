import { SubTabNav } from '@/components/layout/sub-tab-nav';

const tabs = [
  { href: '/create-market', label: 'Binary' },
  { href: '/create-market/scalar', label: 'Scalar' },
  { href: '/create-market/categorical', label: 'Categorical' },
  { href: '/create-market/conditional', label: 'Conditional' },
];

export default function CreateMarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pb-2 pt-4">
        <h1 className="text-2xl font-bold">Create Market</h1>
        <p className="text-sm text-muted-foreground">
          Create new on-chain prediction markets with explicit oracle and settlement parameters.
        </p>
      </div>
      <SubTabNav tabs={tabs} />
      {children}
    </div>
  );
}
