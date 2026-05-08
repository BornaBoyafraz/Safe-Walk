'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const links = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/about',        label: 'About' },
  { href: '/partners',     label: 'Partners' },
];

export function SiteNav() {
  const pathname   = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open,     setOpen]     = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // close mobile menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      <header
        className={cn(
          'fixed left-0 right-0 top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-border/40 bg-background/85 shadow-[0_1px_0_oklch(1_0_0/4%)] backdrop-blur-xl'
            : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg border border-safe/20 bg-safe/8 transition-all duration-200',
              scrolled && 'ring-1 ring-safe/10',
            )}>
              <Logo
                variant="mark"
                size="sm"
                className="transition-transform duration-200 group-hover:scale-110"
              />
            </div>
            <span className="text-sm font-semibold tracking-[-0.015em] text-foreground">Safe Walk</span>
          </Link>

          {/* Desktop nav */}
          <nav className="relative hidden items-center gap-1 md:flex">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative rounded-md px-3 py-1.5 text-sm transition-colors duration-150',
                  pathname === href
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                {pathname === href && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute inset-x-1 -bottom-0.5 h-px rounded-full bg-foreground/50"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="hidden text-sm md:inline-flex">
              <Link href="/demo">Try the demo</Link>
            </Button>
            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-white/[0.04] text-muted-foreground transition hover:text-foreground md:hidden"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 top-16 z-40 border-b border-border/60 bg-background/95 px-6 pb-6 pt-4 backdrop-blur-xl md:hidden"
        >
          <nav className="flex flex-col gap-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm transition-colors',
                  pathname === href
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {label}
              </Link>
            ))}
            <div className="mt-3 border-t border-border/50 pt-3">
              <Button asChild size="sm" className="w-full">
                <Link href="/demo">Try the demo</Link>
              </Button>
            </div>
          </nav>
        </motion.div>
      )}
    </>
  );
}
