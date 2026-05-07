'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import { DemoSidebar } from '@/components/demo/sidebar';
import { GoogleMap, type MapLayers, type RouteMode } from '@/components/map/google-map';
import { BeamsBackground } from '@/components/ui/beams-background';
import { fetchConfig, type RouteResult } from '@/lib/api-client';
import { browserKeyMissingMessage } from '@/lib/google-maps-errors';

const bundledBrowserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';

export default function DemoPage() {
  const [apiKey, setApiKey] = useState<string | null>(bundledBrowserKey || null);
  const [routeData, setRouteData] = useState<RouteResult | null>(null);
  const [activeMode, setActiveMode] = useState<RouteMode>('safest');
  const [layers, setLayers] = useState<MapLayers>({ heatmap: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bundledBrowserKey) return;

    let cancelled = false;
    fetchConfig()
      .then(({ googleMapsApiKey, source }) => {
        if (cancelled) return;
        const key = googleMapsApiKey?.trim() || '';
        setApiKey(key);

        if (!key) {
          setError(browserKeyMissingMessage());
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setApiKey('');
          setError(err instanceof Error ? err.message : 'Could not load map configuration.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="relative h-[100svh] w-screen max-w-[100vw] overflow-hidden bg-background text-foreground">
      <BeamsBackground intensity="subtle" className="opacity-50" />

      <div className="absolute left-4 top-4 z-30 hidden items-center gap-3 md:flex">
        <Link
          href="/"
          className="glass inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="glass inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm">
          <Shield className="h-4 w-4 text-safe" />
          Safe Walk demo
        </div>
      </div>

      <GoogleMap
        apiKey={apiKey}
        routeData={routeData}
        activeMode={activeMode}
        layers={layers}
        onError={setError}
        className="h-full"
      />

      <div className="absolute inset-x-0 bottom-0 z-20 max-h-[72svh] min-w-0 max-w-[100vw] overflow-hidden md:inset-y-4 md:left-4 md:right-auto md:max-h-none md:w-[390px]">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20 md:hidden" />
        <DemoSidebar
          apiKey={apiKey}
          routeData={routeData}
          activeMode={activeMode}
          layers={layers}
          loading={loading}
          error={error}
          onRouteData={setRouteData}
          onActiveMode={setActiveMode}
          onLayers={setLayers}
          onLoading={setLoading}
          onError={setError}
          className="h-[calc(72svh-6px)] rounded-t-3xl md:h-full md:rounded-2xl"
        />
      </div>
    </main>
  );
}
