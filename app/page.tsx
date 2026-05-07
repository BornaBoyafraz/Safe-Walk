'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Layers3, Map, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
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

const stats: Array<[string, string, number | null]> = [
  ['1 in 3', 'Canadian women feel unsafe walking alone at night', null],
  ['1,500+', 'safety incidents were reported on the TTC in 2024', 1500],
  ['0', 'major navigation apps factor safety into pedestrian routing', null],
];

const ease = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden:   { opacity: 0, y: 14 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(eased * target));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

function AnimatedStat({ display, countTarget }: { display: string; countTarget: number | null }) {
  const counter = useCountUp(countTarget ?? 0);
  if (countTarget === null) return <span>{display}</span>;
  return <span ref={counter.ref}>{counter.value.toLocaleString()}+</span>;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-32 md:pb-28 md:pt-40">
        <BeamsBackground intensity="medium" className="opacity-65" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--safe)/0.06),transparent_40%)]" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-safe/20 bg-safe/8 px-3 py-1 text-xs font-medium text-safe">
                <Sparkles className="h-3.5 w-3.5" />
                Safety API for urban navigation
              </div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground/60 uppercase mb-4">
                Toronto open data · Google Maps · TKS Moonshot 2026
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight text-foreground md:text-7xl">
                Safer routes,{' '}
                <span className="text-foreground/70">by design.</span>
              </h1>
            </motion.div>

            <motion.p variants={itemVariants} className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Safe Walk adds pedestrian safety intelligence to Google Maps. Compare the fastest route with the safest using incident data, streetlight coverage, and time-of-day scoring.
            </motion.p>

            <motion.div variants={itemVariants} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-11 rounded-xl px-5">
                <Link href="/demo">
                  Try the demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 rounded-xl px-5">
                <Link href="/how-it-works">How it works</Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Hero map mockup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease }}
            className="relative min-h-[420px] overflow-hidden rounded-2xl border border-border/70 bg-card/50 shadow-2xl shadow-black/50"
          >
            {/* Grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(0deg,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:52px_52px] opacity-25" />

            {/* SVG route visualization */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 380" fill="none" preserveAspectRatio="xMidYMid slice">
              {/* Fastest route — blue, thin */}
              <path
                d="M 60 310 L 60 200 Q 60 180 80 175 L 200 170 Q 220 168 230 155 L 310 130 Q 330 125 340 115 L 360 100"
                stroke="#5a9ef8"
                strokeWidth="2.5"
                strokeOpacity="0.45"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Safest route — green, thicker */}
              <path
                d="M 60 310 L 60 240 Q 60 220 75 210 L 130 205 Q 155 203 165 190 L 200 180 Q 220 175 240 165 L 300 148 Q 320 142 340 130 L 360 100"
                stroke="#2fb872"
                strokeWidth="4"
                strokeOpacity="0.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Origin dot */}
              <circle cx="60" cy="310" r="6" fill="#f7f7f8" />
              <circle cx="60" cy="310" r="10" fill="#f7f7f8" fillOpacity="0.12" />
              {/* Destination dot */}
              <circle cx="360" cy="100" r="6" fill="#2fb872" />
              <circle cx="360" cy="100" r="10" fill="#2fb872" fillOpacity="0.18" />
              {/* Glow on safest route */}
              <path
                d="M 60 310 L 60 240 Q 60 220 75 210 L 130 205 Q 155 203 165 190 L 200 180 Q 220 175 240 165 L 300 148 Q 320 142 340 130 L 360 100"
                stroke="#2fb872"
                strokeWidth="12"
                strokeOpacity="0.08"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Route type badge — top left */}
            <div className="absolute left-4 top-4 rounded-lg border border-border/60 bg-background/70 px-2.5 py-1.5 backdrop-blur-sm">
              <p className="text-[10px] text-muted-foreground">Fastest</p>
              <p className="text-xs font-medium text-blue-400">18 min</p>
            </div>

            {/* Safety score pill — bottom right */}
            <div className="glass absolute bottom-6 left-5 right-5 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Recommended</p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">Safest route</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-safe/25 bg-safe/10 px-2.5 py-1 text-xs font-semibold text-safe">
                    84% safe
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                3 min longer · 27% safer than the fastest path.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats strip */}
      <Section className="border-y border-border/60 bg-card/30 py-14">
        <SectionInner className="grid gap-8 md:grid-cols-3">
          {stats.map(([display, label, countTarget]) => (
            <motion.div
              key={display}
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease }}
            >
              <p className="text-4xl font-semibold tracking-tight text-foreground">
                <AnimatedStat display={display} countTarget={countTarget} />
              </p>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{label}</p>
            </motion.div>
          ))}
        </SectionInner>
      </Section>

      {/* Features */}
      <Section>
        <SectionInner>
          <motion.div
            className="max-w-2xl"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">The missing layer</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Navigation was built for drivers. Pedestrians need a different risk model.
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07, ease }}
              >
                <Card className="group cursor-default border border-border/70 bg-card/50 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-card/70 hover:shadow-lg hover:shadow-black/20">
                  <CardContent className="p-5">
                    <Icon className="h-5 w-5 text-safe" />
                    <h3 className="mt-5 text-base font-semibold">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </SectionInner>
      </Section>

      {/* Data section */}
      <Section className="relative overflow-hidden bg-card/30">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        <SectionInner className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-safe">Real data, not guesswork</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              Every walking path becomes a safety signal.
            </h2>
          </motion.div>
          <motion.div
            className="space-y-6 text-base leading-8 text-muted-foreground"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
          >
            <p>
              Safe Walk samples points along each route and scores them against police incidents, streetlight density, community reports, road context, transit proximity, and time of day.
            </p>
            <p>
              The product is intentionally calm: it does not tell users the whole city is dangerous. It helps them compare options with precise, believable spatial intelligence.
            </p>
            <div className="pt-2">
              <Button asChild variant="outline" className="h-10 rounded-xl px-4 text-sm">
                <Link href="/how-it-works">
                  See the scoring model
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </SectionInner>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
      </Section>

      <SiteFooter />
    </main>
  );
}
