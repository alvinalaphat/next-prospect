'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' || pathname.startsWith('/prospect') : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        'rounded-lg px-4 transition-colors hover:bg-accent',
        active ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      {children}
    </Link>
  );
}
