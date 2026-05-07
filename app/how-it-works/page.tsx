import { Clock, Database, GitBranch, Lightbulb, MapPinned, Route, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Section, SectionInner } from '@/components/ui/section';
import { SiteFooter } from '@/components/site/footer';
import { SiteNav } from '@/components/site/nav';

const layers = [
  {
    icon: Database,
    title: 'Incident density',
    body: 'Reported assaults, robberies, break-and-enters, and other incidents are geocoded, severity-weighted, and recency-decayed.',
  },
  {
    icon: Lightbulb,
    title: 'Streetlight coverage',
    body: 'Nearby streetlights reduce route risk, with lighting weighted more heavily after sunset and before sunrise.',
  },
  {
    icon: Clock,
    title: 'Time of day',
    body: 'The same street can score differently at 2 p.m. and 11 p.m. because context changes when visibility changes.',
  },
  {
    icon: Shield,
    title: 'Community reports',
    body: 'Reports for harassment, poor lighting, and suspicious activity add short-lived signals that official data can miss.',
  },
];

const steps = [
  ['01', 'Request routes', 'Safe Walk asks Google Routes for walking alternatives between the origin and destination.'],
  ['02', 'Sample each path', 'Every polyline is decoded and sampled so the scoring engine can evaluate points along the route.'],
  ['03', 'Score danger cost', 'Each point receives a cost from 0 to 1 using incidents, lighting, reports, road context, and time of day.'],
  ['04', 'Compare options', 'The API returns the fastest route and the safest route so users can choose the tradeoff.'],
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="px-6 pb-16 pt-32 md:pt-40">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">How it works</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            A route is not one line. It is hundreds of safety decisions.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Safe Walk keeps Google Maps as the routing foundation, then adds a safety graph that evaluates the real-world conditions around each walking path.
          </p>
        </div>
      </section>

      <Section className="pt-8">
        <SectionInner>
          <div className="grid gap-4 md:grid-cols-4">
            {layers.map(({ icon: Icon, title, body }) => (
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
        <SectionInner className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">Scoring flow</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Fastest stays visible. Safest becomes computable.
            </h2>
          </div>

          <div className="space-y-0">
            {steps.map(([number, title, body]) => (
              <div key={number} className="grid grid-cols-[72px_1fr] gap-5 border-t border-border/80 py-7 last:border-b">
                <span className="font-mono text-sm text-muted-foreground">{number}</span>
                <div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionInner>
      </Section>

      <Section>
        <SectionInner className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-6">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:48px_48px] opacity-25" />
            <div className="relative h-[330px]">
              <div className="absolute left-6 right-8 top-20 h-1 rounded-full bg-blue-400/35" />
              <div className="absolute bottom-24 left-12 right-10 h-1 rotate-[-12deg] rounded-full bg-safe shadow-[0_0_24px_hsl(var(--safe)/0.45)]" />
              <div className="absolute left-12 top-16 rounded-xl border border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                Fastest: 18 min
              </div>
              <div className="absolute bottom-12 right-8 rounded-xl border border-safe/25 bg-safe/10 px-3 py-2 text-xs text-safe">
                Safest: 21 min, 32% safer
              </div>
              <MapPinned className="absolute left-10 top-40 h-5 w-5 text-foreground" />
              <Route className="absolute right-12 top-28 h-5 w-5 text-safe" />
              <GitBranch className="absolute bottom-28 left-1/2 h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">API shape</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Designed to plug into existing maps.</h2>
            <pre className="mt-6 overflow-x-auto rounded-2xl border border-border/80 bg-black/30 p-5 text-sm leading-7 text-muted-foreground">
{`POST /api/route
{
  "origin": "University of Toronto",
  "destination": "Union Station"
}

{
  "fastest": { "duration": "1040s" },
  "safest":  { "safety_score": 0.18 }
}`}
            </pre>
          </div>
        </SectionInner>
      </Section>

      <SiteFooter />
    </main>
  );
}
