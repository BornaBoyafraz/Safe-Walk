import { Compass, Target, Users } from 'lucide-react';
import { BeamsBackground } from '@/components/ui/beams-background';
import { Card, CardContent } from '@/components/ui/card';
import { Section, SectionInner } from '@/components/ui/section';
import { SiteFooter } from '@/components/site/footer';
import { SiteNav } from '@/components/site/nav';

const principles = [
  {
    icon: Compass,
    title: 'Pedestrian-first navigation',
    body: 'Drivers optimize for speed. Walkers also care about lighting, exposure, street context, and whether a path feels reasonable after dark.',
  },
  {
    icon: Target,
    title: 'Safety as infrastructure',
    body: 'Safe Walk is designed as an API layer that cities, campuses, transit agencies, and apps can use without replacing their maps.',
  },
  {
    icon: Users,
    title: 'Community signal',
    body: 'Reports from people on the ground capture concerns that never become official data, then decay over time so the map stays current.',
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="relative overflow-hidden px-6 pb-20 pt-32 md:pt-40">
        <BeamsBackground intensity="subtle" className="opacity-60" />
        <div className="relative z-10 mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">About Safe Walk</p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Walking directions should understand what walking actually feels like.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Safe Walk was built by Seyedborna Boyafraz as a TKS Moonshot project. The goal is simple: make pedestrian safety a first-class routing parameter, not an afterthought hidden behind shortest-path logic.
          </p>
        </div>
      </section>

      <Section className="pt-10">
        <SectionInner className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">Founder note</p>
          </div>
          <div className="space-y-6 text-lg leading-9 text-muted-foreground">
            <p>
              Most navigation products were invented for cars. Pedestrian routing was added later, but the underlying goal stayed the same: reduce travel time.
            </p>
            <p>
              That misses the reality of walking. A route can be technically faster while being poorly lit, isolated, or routed through an area with a higher incident pattern at night.
            </p>
            <blockquote className="border-l-2 border-safe pl-6 text-2xl font-semibold leading-9 text-foreground">
              Safe Walk exists so the safest path can be visible before someone has to choose it from instinct.
            </blockquote>
            <p>
              The first version focuses on Toronto because the city has rich open data: police incident records, streetlight locations, road context, and transit geography. The bigger vision is a safety API that can sit underneath any urban mobility product.
            </p>
          </div>
        </SectionInner>
      </Section>

      <Section className="bg-card/35">
        <SectionInner>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">Operating principles</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Calm, precise, trustworthy.</h2>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {principles.map(({ icon: Icon, title, body }) => (
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

      <SiteFooter />
    </main>
  );
}
