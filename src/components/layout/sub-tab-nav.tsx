'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SubTab {
  href: string;
  label: string;
}

interface SubTabNavProps {
  tabs: SubTab[];
}

export function SubTabNav({ tabs }: SubTabNavProps) {
  const pathname = usePathname();

  return (
    <div className="border-b">
      <nav className="flex gap-1 px-4 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
