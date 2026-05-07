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
  apiKey: string;
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

function usePlacesAutocomplete(apiKey: string, inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let cancelled = false;

    async function attachAutocomplete() {
      await loadGoogleMaps(apiKey);
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

    attachAutocomplete().catch(() => undefined);

    return () => {
      cancelled = true;
      if (autocomplete && globalThis.google?.maps?.event) {
        google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [apiKey, inputRef]);
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

  usePlacesAutocomplete(apiKey, originRef);
  usePlacesAutocomplete(apiKey, destinationRef);

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
    <aside className={cn('glass flex h-full flex-col overflow-hidden rounded-none border-white/10 bg-background/76', className)}>
      <div className="border-b border-border/80 px-5 py-5">
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

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <form className="space-y-3" onSubmit={handleSubmit}>
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
          <div className="mt-4 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-xs leading-relaxed text-red-200">
            {error}
          </div>
        )}

        {!routeData && !loading && (
          <div className="mt-10 rounded-2xl border border-border/80 bg-card/40 p-5">
            <Navigation className="mb-4 h-5 w-5 text-safe" />
            <p className="text-base font-medium text-foreground">Where are you walking?</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Compare speed, lighting, incident density, and time-of-day risk on a single Toronto route.
            </p>
          </div>
        )}

        {loading && (
          <div className="mt-6 space-y-3">
            <div className="h-28 rounded-2xl border border-border/80 shimmer-bg" />
            <div className="h-28 rounded-2xl border border-border/80 shimmer-bg" />
          </div>
        )}

        {routeData && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border/80 bg-card/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Active route</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {activeMode === 'safest' ? 'Safest path' : 'Fastest path'}
                  </p>
                </div>
                <SafetyMeter score={activeSafety} size="md" />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{formatDelta(routeData)}</p>
            </div>

            <RouteCard
              type="safest"
              active={activeMode === 'safest'}
              durationMin={durationToMinutes(routeData.safest.duration)}
              distanceKm={metersToKm(routeData.safest.distanceMeters)}
              safetyScore={dangerToSafetyPercent(routeData.safest.safety_score)}
              onClick={() => onActiveMode('safest')}
            />
            <RouteCard
              type="fastest"
              active={activeMode === 'fastest'}
              durationMin={durationToMinutes(routeData.fastest.duration)}
              distanceKm={metersToKm(routeData.fastest.distanceMeters)}
              safetyScore={dangerToSafetyPercent(routeData.fastest.safety_score)}
              onClick={() => onActiveMode('fastest')}
            />
          </div>
        )}
      </div>

      <div className="border-t border-border/80 px-5 py-4">
        <div className="grid grid-cols-3 gap-2">
          {layerOptions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleLayer(key)}
              className={cn(
                'flex h-10 items-center justify-center gap-1.5 rounded-lg border text-xs transition',
                layers[key]
                  ? 'border-safe/30 bg-safe/12 text-foreground'
                  : 'border-border/80 bg-white/[0.035] text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <span className="h-1.5 w-10 rounded-full bg-gradient-to-r from-amber-300/20 via-orange-400/50 to-red-700/75" />
          Warmer density means more recent nearby incidents, not a blocked route.
        </div>
      </div>
    </aside>
  );
}
