'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { WalletButton } from '@/components/wallet/wallet-button';
import { useUIStore } from '@/store';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  BarChart3,
  LineChart,
  Briefcase,
  Activity,
  Brain,
  Vote,
  PlusCircle,
  GraduationCap,
} from 'lucide-react';

const navItems = [
  { href: '/markets', label: 'Markets', icon: BarChart3 },
  { href: '/trade', label: 'Trade', icon: LineChart },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/analytics', label: 'Analytics', icon: Activity },
  { href: '/ai-risk', label: 'AI Risk', icon: Brain },
  { href: '/governance', label: 'Governance', icon: Vote },
  { href: '/create-market', label: 'Create Market', icon: PlusCircle },
  { href: '/learn', label: 'Learn', icon: GraduationCap },
];

export function Header() {
  const pathname = usePathname();
  const { simpleMode, toggleSimpleMode } = useUIStore();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 gap-4">
        {/* Logo */}
        <Link href="/markets" className="flex items-center gap-2 mr-4 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg hidden sm:inline">DeepSeer</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 overflow-x-auto flex-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Simple Mode Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Label htmlFor="simple-mode" className="text-xs text-muted-foreground hidden lg:inline">
            Simple
          </Label>
          <Switch
            id="simple-mode"
            checked={simpleMode}
            onCheckedChange={toggleSimpleMode}
          />
        </div>

        {/* Wallet */}
        <WalletButton />
      </div>
    </header>
  );
}
