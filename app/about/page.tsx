import { Compass, Target, Users } from 'lucide-react';
import { BeamsBackground } from '@/components/ui/beams-background';
import { Card, CardContent } from '@/components/ui/card';
import { Reveal } from '@/components/ui/reveal';
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
        <BeamsBackground intensity="subtle" className="opacity-55" />
        <div className="relative z-10 mx-auto max-w-4xl">
          <Reveal>
            <p className="mb-4 text-[11px] font-medium tracking-[0.18em] text-muted-foreground/60 uppercase">
              Toronto, Canada · TKS Moonshot 2026
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">About Safe Walk</p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Walking directions should understand what walking actually feels like.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
              Safe Walk was built by Seyedborna Boyafraz as a TKS Moonshot project. The goal is simple: make pedestrian safety a first-class routing parameter, not an afterthought hidden behind shortest-path logic.
            </p>
          </Reveal>
        </div>
      </section>

      <Section className="pt-10">
        <SectionInner className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">Founder note</p>
          </Reveal>
          <Reveal delay={0.08} className="space-y-6 text-lg leading-9 text-muted-foreground">
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
          </Reveal>
        </SectionInner>
      </Section>

      <Section className="relative overflow-hidden bg-card/30">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        <SectionInner>
          <Reveal className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">Operating principles</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Calm, precise, trustworthy.</h2>
          </Reveal>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {principles.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.07}>
                <Card className="h-full border border-border/70 bg-card/50 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-card/70 hover:shadow-lg hover:shadow-black/20">
                  <CardContent className="p-5">
                    <Icon className="h-5 w-5 text-safe" />
                    <h3 className="mt-5 text-base font-semibold">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </SectionInner>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
      </Section>

      <SiteFooter />
    </main>
  );
}
