import Link from 'next/link';
import { ArrowRight, Building2, GraduationCap, Map, TrainFront } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Section, SectionInner } from '@/components/ui/section';
import { SiteFooter } from '@/components/site/footer';
import { SiteNav } from '@/components/site/nav';

const useCases = [
  {
    icon: GraduationCap,
    title: 'Campuses',
    body: 'Help students compare safer late-night walking paths between residences, libraries, transit stops, and event venues.',
  },
  {
    icon: TrainFront,
    title: 'Transit agencies',
    body: 'Add safety-aware first-mile and last-mile routing around stations, stops, and service disruptions.',
  },
  {
    icon: Map,
    title: 'Navigation platforms',
    body: 'Expose safest-route alternatives without rebuilding a routing engine from scratch.',
  },
  {
    icon: Building2,
    title: 'Cities and BIAs',
    body: 'Turn streetlight investments, open data, and public safety signals into visible pedestrian guidance.',
  },
];

const tiers = [
  ['Pilot', 'For demos, campus pilots, and small geographic areas.', 'Route safety scoring', 'Heatmap overlay', 'Basic analytics'],
  ['Platform', 'For organizations integrating safety into a production app.', 'Higher request volume', 'Custom data layers', 'Partner reporting'],
  ['City', 'For municipalities and agencies managing city-scale walking safety.', 'Multi-region scoring', 'Data governance support', 'Deployment review'],
];

export default function PartnersPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="px-6 pb-16 pt-32 text-center md:pt-40">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">For partners</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Add safety-aware routing to the places people already walk.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Safe Walk is built as a layer: an API, visualization system, and demo experience that can support campuses, cities, transit agencies, and mobility platforms.
          </p>
          <div className="mt-9 flex justify-center">
            <Button asChild size="lg" className="h-11 rounded-xl px-5">
              <Link href="/demo">
                Try the demo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Section className="pt-8">
        <SectionInner>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {useCases.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="border border-border/80 bg-card/55">
                <CardContent className="p-5">
                  <Icon className="h-5 w-5 text-safe" />
                  <h2 className="mt-5 text-base font-semibold">{title}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionInner>
      </Section>

      <Section className="bg-card/35">
        <SectionInner>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">Integration model</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Start with a pilot. Expand into infrastructure.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {tiers.map(([name, description, a, b, c]) => (
              <Card key={name} className="border border-border/80 bg-card/55">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold">{name}</h3>
                  <p className="mt-3 min-h-16 text-sm leading-6 text-muted-foreground">{description}</p>
                  <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                    {[a, b, c].map((item) => (
                      <div key={item} className="flex items-center gap-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-safe" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </SectionInner>
      </Section>

      <Section>
        <SectionInner className="rounded-2xl border border-border/80 bg-card/55 p-8 md:p-12">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">Pitch-ready</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">A serious safety layer for serious urban mobility products.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                The current prototype focuses on Toronto, but the architecture is meant to scale to other cities with comparable open data and partner data sources.
              </p>
            </div>
            <Button asChild variant="outline" className="h-11 rounded-xl px-5">
              <Link href="/how-it-works">View scoring model</Link>
            </Button>
          </div>
        </SectionInner>
      </Section>

      <SiteFooter />
    </main>
  );
}
