'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

const links = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/about',        label: 'About' },
  { href: '/partners',     label: 'Partners' },
];

export function SiteNav() {
  const pathname  = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-[0_1px_0_oklch(1_0_0/5%)]'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <Shield className="h-5 w-5 text-safe group-hover:scale-110 transition-transform" style={{ color: 'var(--safe)' }} />
          <span className="text-sm font-semibold tracking-tight text-foreground">Safe Walk</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                pathname === href
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <Button asChild size="sm" className="text-sm">
          <Link href="/demo">Try the demo</Link>
        </Button>
      </div>
    </header>
  );
}
