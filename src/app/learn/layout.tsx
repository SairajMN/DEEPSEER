import { SubTabNav } from '@/components/layout/sub-tab-nav';

const tabs = [
  { href: '/learn', label: 'Prediction Markets' },
  { href: '/learn/amm', label: 'How AMMs Work' },
  { href: '/learn/settlement', label: 'Settlement' },
  { href: '/learn/ai-risk', label: 'AI Risk Scoring' },
  { href: '/learn/charts', label: 'Read Charts' },
];

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pb-2 pt-4">
        <h1 className="text-2xl font-bold">Learn</h1>
        <p className="text-sm text-muted-foreground">
          Beginner-friendly explanations for trading, risk, and settlement mechanics.
        </p>
      </div>
      <SubTabNav tabs={tabs} />
      {children}
    </div>
  );
}
