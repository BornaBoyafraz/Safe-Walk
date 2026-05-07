import Link from 'next/link';
import { Shield } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-background px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-safe/25 bg-safe/10">
            <Shield className="h-4 w-4 text-safe" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Safe Walk</p>
            <p className="text-xs text-muted-foreground">Built for TKS Moonshot 2026.</p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-5 text-sm text-muted-foreground">
          <Link className="transition hover:text-foreground" href="/demo">Demo</Link>
          <Link className="transition hover:text-foreground" href="/how-it-works">How it works</Link>
          <Link className="transition hover:text-foreground" href="/about">About</Link>
          <Link className="transition hover:text-foreground" href="/partners">Partners</Link>
        </nav>
      </div>
    </footer>
  );
}
