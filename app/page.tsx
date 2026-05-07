import Link from 'next/link';
import { ArrowRight, Layers3, Map, ShieldCheck, Sparkles } from 'lucide-react';
import { BeamsBackground } from '@/components/ui/beams-background';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Section, SectionInner } from '@/components/ui/section';
import { SiteFooter } from '@/components/site/footer';
import { SiteNav } from '@/components/site/nav';

const features = [
  {
    icon: Layers3,
    title: 'Multi-layer scoring',
    body: 'Incident density, lighting coverage, community reports, and time of day combine into a single route safety cost.',
  },
  {
    icon: Map,
    title: 'Built on Google Maps',
    body: 'Safe Walk requests walking alternatives from Google Routes, then ranks each path with its own safety graph.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety, not alarm',
    body: 'The interface shows risk with calm GIS-style density, preserving roads, labels, and user trust.',
  },
];

const stats = [
  ['1 in 3', 'Canadian women feel unsafe walking alone at night'],
  ['1,500+', 'safety incidents were reported on the TTC in 2024'],
  ['0', 'major navigation apps factor safety into pedestrian routing'],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="relative overflow-hidden px-6 pb-24 pt-32 md:pb-28 md:pt-40">
        <BeamsBackground intensity="medium" className="opacity-70" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--safe)/0.08),transparent_38%)]" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-safe/20 bg-safe/10 px-3 py-1 text-xs font-medium text-safe">
              <Sparkles className="h-3.5 w-3.5" />
              Safety API for urban navigation
            </div>

            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight text-foreground md:text-7xl">
              Safer routes, by design.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              Safe Walk adds pedestrian safety intelligence to Google Maps. It compares the fastest route with the safest route using incident data, streetlight coverage, community reports, and time-of-day scoring.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-11 rounded-xl px-5">
                <Link href="/demo">
                  Try the demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-xl px-5">
                <Link href="/how-it-works">How it works</Link>
              </Button>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-border/80 bg-card/60 shadow-2xl shadow-black/40">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--border)/0.45)_1px,transparent_1px)] bg-[size:56px_56px] opacity-30" />
            <div className="absolute inset-x-12 top-24 h-1 rounded-full bg-blue-400/30" />
            <div className="absolute left-20 top-24 h-44 w-1 rounded-full bg-blue-400/30" />
            <div className="absolute left-20 top-52 h-1 w-64 rotate-[-18deg] rounded-full bg-safe shadow-[0_0_28px_hsl(var(--safe)/0.45)]" />
            <div className="absolute left-16 top-48 h-3 w-3 rounded-full bg-white ring-4 ring-white/10" />
            <div className="absolute right-24 top-36 h-3 w-3 rounded-full bg-safe ring-4 ring-safe/15" />

            <div className="glass absolute bottom-6 left-6 right-6 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recommended</p>
                  <p className="mt-1 text-lg font-semibold">Safest route</p>
                </div>
                <div className="rounded-full border border-safe/25 bg-safe/10 px-3 py-1 text-sm font-medium text-safe">
                  84% safe
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                3 min longer, 27% safer than the fastest path.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section className="border-y border-border/80 bg-card/35 py-16">
        <SectionInner className="grid gap-8 md:grid-cols-3">
          {stats.map(([value, label]) => (
            <div key={value} className="text-center">
              <p className="text-4xl font-semibold tracking-tight text-foreground">{value}</p>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{label}</p>
            </div>
          ))}
        </SectionInner>
      </Section>

      <Section>
        <SectionInner>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">The missing layer</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Navigation was built for drivers. Pedestrians need a different risk model.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="border border-border/80 bg-card/55">
                <CardContent className="p-5">
                  <Icon className="h-5 w-5 text-safe" />
                  <h3 className="mt-5 text-base font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionInner>
      </Section>

      <Section className="bg-card/35">
        <SectionInner className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">Real data, not guesswork</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Every walking path becomes a safety signal.
            </h2>
          </div>
          <div className="space-y-6 text-base leading-8 text-muted-foreground">
            <p>
              Safe Walk samples points along each route and scores them against police incidents, streetlight density, community reports, road context, transit proximity, and time of day.
            </p>
            <p>
              The product is intentionally calm: it does not tell users the whole city is dangerous. It helps them compare options with precise, believable spatial intelligence.
            </p>
          </div>
        </SectionInner>
      </Section>

      <SiteFooter />
    </main>
  );
}
