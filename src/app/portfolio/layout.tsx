import { SubTabNav } from '@/components/layout/sub-tab-nav';
import { PortfolioBootstrap } from '@/components/portfolio/portfolio-bootstrap';

const tabs = [
  { href: '/portfolio', label: 'Open Positions' },
  { href: '/portfolio/pnl', label: 'P&L' },
  { href: '/portfolio/exposure', label: 'Exposure Heatmap' },
  { href: '/portfolio/metrics', label: 'Performance Metrics' },
];

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PortfolioBootstrap />
      <div className="px-4 pb-2 pt-4">
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          Track your positions and performance using live on-chain position data.
        </p>
      </div>
      <SubTabNav tabs={tabs} />
      {children}
    </div>
  );
}
