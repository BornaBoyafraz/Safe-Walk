import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/60 bg-background px-6 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-safe/20 bg-safe/8">
            <Logo variant="mark" size="sm" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.015em] text-foreground">Safe Walk</p>
            <p className="text-xs text-muted-foreground">Pedestrian safety intelligence for Toronto.</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-5 text-sm text-muted-foreground">
          <Link className="transition hover:text-foreground" href="/demo">Demo</Link>
          <Link className="transition hover:text-foreground" href="/how-it-works">How it works</Link>
          <Link className="transition hover:text-foreground" href="/about">About</Link>
          <Link className="transition hover:text-foreground" href="/partners">Partners</Link>
        </nav>

        <div className="rounded-full border border-border/50 bg-card/40 px-3 py-1 text-[11px] text-muted-foreground/60">
          TKS Moonshot 2026
        </div>
      </div>
    </footer>
  );
}
