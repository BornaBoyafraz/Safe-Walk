'use client';

import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Flame, Lightbulb, Loader2, MapPin, Navigation, Search, Shield, TrainFront } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RouteCard } from '@/components/ui/route-card';
import { SafetyMeter } from '@/components/ui/safety-meter';
import { fetchRoute, type RouteResult } from '@/lib/api-client';
import { loadGoogleMaps } from '@/lib/google-maps-loader';
import { cn } from '@/lib/utils';
import { dangerToSafetyPercent, durationToMinutes, metersToKm } from '@/lib/polyline';
import type { MapLayers, RouteMode } from '@/components/map/google-map';

interface DemoSidebarProps {
  apiKey: string | null;
  routeData: RouteResult | null;
  activeMode: RouteMode;
  layers: MapLayers;
  loading: boolean;
  error: string | null;
  onRouteData: (data: RouteResult | null) => void;
  onActiveMode: (mode: RouteMode) => void;
  onLayers: (layers: MapLayers) => void;
  onLoading: (loading: boolean) => void;
  onError: (message: string | null) => void;
  className?: string;
}

function usePlacesAutocomplete(
  apiKey: string | null,
  inputRef: RefObject<HTMLInputElement | null>,
  onError: (message: string | null) => void,
) {
  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    const browserKey = apiKey;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let cancelled = false;

    async function attachAutocomplete() {
      await loadGoogleMaps(browserKey);
      if (cancelled || !inputRef.current) return;

      const bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(43.58, -79.64),
        new google.maps.LatLng(43.86, -79.12),
      );

      autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        bounds,
        strictBounds: false,
        fields: ['formatted_address', 'geometry', 'name'],
      });
    }

    attachAutocomplete().catch((error) => {
      const message = error instanceof Error ? error.message : 'Places Autocomplete failed to initialize.';
      console.error('[Safe Walk] Places Autocomplete failed:', error);
      onError(message);
    });

    return () => {
      cancelled = true;
      if (autocomplete && globalThis.google?.maps?.event) {
        google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [apiKey, inputRef, onError]);
}

function formatDelta(routeData: RouteResult) {
  const safestMinutes = durationToMinutes(routeData.safest.duration);
  const fastestMinutes = durationToMinutes(routeData.fastest.duration);
  const safestPct = dangerToSafetyPercent(routeData.safest.safety_score);
  const fastestPct = dangerToSafetyPercent(routeData.fastest.safety_score);
  const extraMinutes = safestMinutes - fastestMinutes;
  const safetyGain = safestPct - fastestPct;

  if (Math.abs(routeData.fastest.safety_score - routeData.safest.safety_score) < 0.05) {
    return 'The route options have a similar safety profile for this walk.';
  }

  if (extraMinutes <= 0 && safetyGain > 0) {
    return `No extra time, ${safetyGain}% safer than the fastest path.`;
  }

  if (extraMinutes > 0 && safetyGain > 0) {
    return `${extraMinutes} min longer, ${safetyGain}% safer than the fastest path.`;
  }

  return `${extraMinutes > 0 ? `${extraMinutes} min longer` : 'Same walk time'} with a different safety profile.`;
}

function routeConfidence(routeData: RouteResult): { label: string; color: string } {
  const diff = Math.abs(routeData.safest.safety_score - routeData.fastest.safety_score);
  if (diff >= 0.18) return { label: 'Strong signal', color: 'text-safe' };
  if (diff >= 0.07) return { label: 'Moderate signal', color: 'text-amber-400' };
  return { label: 'Similar profiles', color: 'text-muted-foreground' };
}

const layerOptions: Array<{
  key: keyof MapLayers;
  label: string;
  icon: typeof Flame;
}> = [
  { key: 'heatmap', label: 'Heatmap', icon: Flame },
  { key: 'streetlights', label: 'Lights', icon: Lightbulb },
  { key: 'transit', label: 'Transit', icon: TrainFront },
];

export function DemoSidebar({
  apiKey,
  routeData,
  activeMode,
  layers,
  loading,
  error,
  onRouteData,
  onActiveMode,
  onLayers,
  onLoading,
  onError,
  className,
}: DemoSidebarProps) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const originRef = useRef<HTMLInputElement | null>(null);
  const destinationRef = useRef<HTMLInputElement | null>(null);

  usePlacesAutocomplete(apiKey, originRef, onError);
  usePlacesAutocomplete(apiKey, destinationRef, onError);

  const activeRoute = routeData?.[activeMode];
  const activeSafety = useMemo(
    () => dangerToSafetyPercent(activeRoute?.safety_score ?? 0.5),
    [activeRoute],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!origin.trim() || !destination.trim()) {
      onError('Enter both a start and destination.');
      return;
    }

    onLoading(true);
    onError(null);
    onRouteData(null);

    try {
      const data = await fetchRoute(origin.trim(), destination.trim());
      onRouteData(data);
      onActiveMode('safest');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Route computation failed.');
    } finally {
      onLoading(false);
    }
  }

  function toggleLayer(key: keyof MapLayers) {
    onLayers({ ...layers, [key]: !layers[key] });
  }

  return (
    <aside className={cn('glass flex h-full w-full max-w-[100vw] min-w-0 flex-col overflow-hidden rounded-none border-white/10 bg-background/76', className)}>
      <div className="border-b border-border/80 px-4 py-5 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-safe/25 bg-safe/10">
            <Shield className="h-4 w-4 text-safe" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-foreground">Safe Walk</p>
            <p className="text-xs text-muted-foreground">Pedestrian safety intelligence</p>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        <form className="max-w-[342px] space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="sr-only">Starting point</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_18px_hsl(var(--foreground)/0.4)]" />
              <Input
                ref={originRef}
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
                placeholder="From"
                autoComplete="off"
                className="h-11 rounded-xl bg-white/[0.045] pl-8 text-sm"
              />
            </div>
          </label>

          <label className="block">
            <span className="sr-only">Destination</span>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-safe" />
              <Input
                ref={destinationRef}
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="To"
                autoComplete="off"
                className="h-11 rounded-xl bg-white/[0.045] pl-8 text-sm"
              />
            </div>
          </label>

          <motion.div whileTap={{ scale: 0.99 }}>
            <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Find safest route
            </Button>
          </motion.div>
        </form>

        {error && (
          <div className="mt-4 max-w-[342px] rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-red-200">
            {error}
          </div>
        )}

        {!routeData && !loading && (
          <div className="mt-8 min-w-0 max-w-[342px] rounded-2xl border border-border/60 bg-card/30 p-5">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-safe/20 bg-safe/8">
              <Navigation className="h-4 w-4 text-safe" />
            </div>
            <p className="text-sm font-semibold text-foreground">Where are you walking?</p>
            <p className="mt-2 max-w-full break-words text-sm leading-relaxed text-muted-foreground">
              Enter a start and destination to compare the fastest route against the safest path in Toronto.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['U of T → Union Station', 'Spadina → CN Tower'].map((example) => (
                <span key={example} className="rounded-md border border-border/50 bg-white/[0.03] px-2 py-1 text-[11px] text-muted-foreground">
                  {example}
                </span>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="mt-6 max-w-[342px] space-y-3">
            {/* Summary card skeleton */}
            <div className="rounded-2xl border border-border/50 bg-card/30 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2.5 pt-0.5">
                  <div className="h-2.5 w-16 rounded-full shimmer-bg" />
                  <div className="h-4 w-24 rounded-full shimmer-bg" />
                </div>
                <div className="h-14 w-14 rounded-full shimmer-bg" />
              </div>
              <div className="mt-4 h-2.5 w-4/5 rounded-full shimmer-bg" />
              <div className="mt-2 h-2.5 w-3/5 rounded-full shimmer-bg" />
            </div>
            {/* Route card skeletons */}
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-card/20 p-4">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded shimmer-bg" />
                  <div className="h-3.5 w-20 rounded-full shimmer-bg" />
                </div>
                <div className="mt-4 flex gap-4">
                  <div className="h-2.5 w-14 rounded-full shimmer-bg" />
                  <div className="h-2.5 w-12 rounded-full shimmer-bg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {routeData && (
          <motion.div
            key={routeData.safest.polyline}
            className="mt-6 max-w-[342px] space-y-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.07 } },
            }}
          >
            <motion.div
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
              className="rounded-2xl border border-border/60 bg-card/50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Active route</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {activeMode === 'safest' ? 'Safest path' : 'Fastest path'}
                  </p>
                  <span className={cn('mt-1.5 inline-block text-[11px] font-medium', routeConfidence(routeData).color)}>
                    {routeConfidence(routeData).label}
                  </span>
                </div>
                <SafetyMeter score={activeSafety} size="md" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{formatDelta(routeData)}</p>
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
            >
              <RouteCard
                type="safest"
                active={activeMode === 'safest'}
                durationMin={durationToMinutes(routeData.safest.duration)}
                distanceKm={metersToKm(routeData.safest.distanceMeters)}
                safetyScore={dangerToSafetyPercent(routeData.safest.safety_score)}
                onClick={() => onActiveMode('safest')}
              />
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
            >
              <RouteCard
                type="fastest"
                active={activeMode === 'fastest'}
                durationMin={durationToMinutes(routeData.fastest.duration)}
                distanceKm={metersToKm(routeData.fastest.distanceMeters)}
                safetyScore={dangerToSafetyPercent(routeData.fastest.safety_score)}
                onClick={() => onActiveMode('fastest')}
              />
            </motion.div>
          </motion.div>
        )}
      </div>

      <div className="min-w-0 border-t border-border/80 px-4 py-4 sm:px-5">
        <div className="grid w-full max-w-[342px] min-w-0 grid-cols-3 gap-2">
          {layerOptions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleLayer(key)}
              className={cn(
                'flex h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-1 text-xs transition-all duration-150',
                layers[key]
                  ? 'border-safe/35 bg-safe/10 text-foreground ring-1 ring-inset ring-safe/15'
                  : 'border-border/60 bg-white/[0.03] text-muted-foreground hover:border-border/80 hover:bg-white/[0.06] hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate max-[420px]:sr-only">{label}</span>
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-3 w-full max-w-[342px] min-w-0 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
            <span>Incident density</span>
            <span>Toronto Police open data</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/50">Low</span>
            <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-amber-200/15 via-orange-400/38 to-orange-700/52" />
            <span className="text-[10px] text-muted-foreground/50">High</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground/55">
            Warmer areas reflect higher incident concentration — not blocked routes.
          </p>
        </div>
      </div>
    </aside>
  );
}
