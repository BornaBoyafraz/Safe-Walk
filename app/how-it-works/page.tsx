import { Clock, Database, GitBranch, Lightbulb, MapPinned, Route, Shield } from 'lucide-react';
import { BeamsBackground } from '@/components/ui/beams-background';
import { Card, CardContent } from '@/components/ui/card';
import { Reveal } from '@/components/ui/reveal';
import { Section, SectionInner } from '@/components/ui/section';
import { SiteFooter } from '@/components/site/footer';
import { SiteNav } from '@/components/site/nav';

const layers = [
  {
    icon: Database,
    title: 'Incident density',
    body: 'Reported assaults, robberies, break-and-enters, and other incidents are geocoded for calm map context.',
  },
  {
    icon: Lightbulb,
    title: 'Streetlight coverage',
    body: 'Streetlight records can be layered onto the map so partners can understand visibility conditions.',
  },
  {
    icon: Clock,
    title: 'Route alternatives',
    body: 'Google Routes returns walking options that Safe Walk displays without assigning a numeric safety rating.',
  },
  {
    icon: Shield,
    title: 'Community reports',
    body: 'The schema can support community reports as contextual overlays without turning them into a rating.',
  },
];

const steps = [
  ['01', 'Request routes', 'Safe Walk asks Google Routes for walking alternatives between the origin and destination.'],
  ['02', 'Decode each path', 'Every polyline is decoded so the map can draw route options cleanly and fit the camera around them.'],
  ['03', 'Remove duplicates', 'Overlapping paths are filtered so the demo shows meaningful alternatives instead of repeated lines.'],
  ['04', 'Compare options', 'The API returns the fastest route and a distinct comparison route when one is available.'],
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="relative overflow-hidden px-6 pb-16 pt-32 md:pt-40">
        <BeamsBackground intensity="subtle" className="opacity-45" />
        <div className="relative z-10 mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">How it works</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              A route is not one line. It is a set of choices.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
              Safe Walk keeps Google Maps as the routing foundation, then adds civic data layers that help people understand the real-world conditions around each walking path.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Signal layers */}
      <Section className="pt-8">
        <SectionInner>
          <div className="grid gap-4 md:grid-cols-4">
            {layers.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.07}>
                <Card className="h-full border border-border/70 bg-card/50 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-card/70 hover:shadow-lg hover:shadow-black/20">
                  <CardContent className="p-5">
                    <Icon className="h-5 w-5 text-safe" />
                    <h2 className="mt-5 text-base font-semibold">{title}</h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </SectionInner>
      </Section>

      {/* Routing flow */}
      <Section className="relative overflow-hidden bg-card/30">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        <SectionInner className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">Routing flow</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Fastest stays visible. Alternatives stay explainable.
            </h2>
          </Reveal>

          <div className="relative space-y-0">
            {/* vertical connecting line */}
            <div className="absolute left-[35px] top-8 -bottom-0 w-px bg-border/40" aria-hidden />
            {steps.map(([number, title, body], i) => (
              <Reveal key={number} delay={i * 0.07}>
                <div className="grid grid-cols-[72px_1fr] gap-5 border-t border-border/60 py-7 last:border-b">
                  <div className="relative flex flex-col items-center pt-1">
                    <span className="relative z-10 flex h-6 w-9 items-center justify-center rounded-md border border-border/60 bg-background text-[11px] font-mono text-muted-foreground">
                      {number}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </SectionInner>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
      </Section>

      {/* API shape */}
      <Section>
        <SectionInner className="grid items-center gap-12 lg:grid-cols-2">
          {/* SVG route mockup (matches hero) */}
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/50 p-6">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
              <div className="relative h-[280px]">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 260" fill="none" preserveAspectRatio="xMidYMid slice">
                  <path d="M 55 220 L 55 145 Q 55 130 70 124 L 175 118 Q 195 116 205 106 L 270 92 Q 290 88 300 80 L 340 68" style={{ stroke: 'hsl(var(--route-fast))' }} strokeWidth="2" strokeOpacity="0.4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 55 220 L 55 160 Q 55 145 68 138 L 115 134 Q 138 132 148 122 L 185 112 Q 205 108 218 100 L 275 84 Q 295 78 310 70 L 340 68" style={{ stroke: 'hsl(var(--safe))' }} strokeWidth="3.5" strokeOpacity="0.9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 55 220 L 55 160 Q 55 145 68 138 L 115 134 Q 138 132 148 122 L 185 112 Q 205 108 218 100 L 275 84 Q 295 78 310 70 L 340 68" style={{ stroke: 'hsl(var(--safe))' }} strokeWidth="14" strokeOpacity="0.06" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="55" cy="220" r="5" style={{ fill: 'hsl(var(--foreground))' }} />
                  <circle cx="55" cy="220" r="9" style={{ fill: 'hsl(var(--foreground))' }} fillOpacity="0.1" />
                  <circle cx="340" cy="68" r="5" style={{ fill: 'hsl(var(--safe))' }} />
                  <circle cx="340" cy="68" r="9" style={{ fill: 'hsl(var(--safe))' }} fillOpacity="0.15" />
                </svg>
                <div className="absolute left-10 top-12 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur-sm">
                  Fastest: 18 min
                </div>
                <div className="absolute bottom-8 right-6 rounded-xl border border-safe/25 bg-safe/10 px-3 py-2 text-xs text-safe">
                  Alternate: 21 min
                </div>
                <MapPinned className="absolute left-8 top-28 h-4 w-4 text-muted-foreground/60" />
                <Route className="absolute right-10 top-20 h-4 w-4 text-safe/60" />
                <GitBranch className="absolute bottom-20 left-1/2 h-4 w-4 text-muted-foreground/40" />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">API shape</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Designed to plug into existing maps.</h2>
            <pre className="mt-6 overflow-x-auto rounded-2xl border border-border/70 bg-black/25 p-5 text-sm leading-7 text-muted-foreground">
{`POST /api/route
{
  "origin": "University of Toronto",
  "destination": "Union Station"
}

{
  "fastest": { "duration": "1040s" },
  "alternate": { "duration": "1210s" }
}`}
            </pre>
          </Reveal>
        </SectionInner>
      </Section>

      <SiteFooter />
    </main>
  );
}
