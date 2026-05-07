'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, MapPinned } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchStreetlights, type RouteResult, type StreetlightPoint } from '@/lib/api-client';
import { loadGoogleMaps } from '@/lib/google-maps-loader';
import { darkMapStyles } from '@/lib/map-style';
import { decodePolyline } from '@/lib/polyline';
import { HeatmapLayer } from './heatmap-layer';

export type RouteMode = 'safest' | 'fastest';

export interface MapLayers {
  heatmap: boolean;
  streetlights: boolean;
  transit: boolean;
}

interface GoogleMapProps {
  apiKey: string;
  routeData: RouteResult | null;
  activeMode: RouteMode;
  layers: MapLayers;
  className?: string;
  onError?: (message: string) => void;
}

function polylineStyle(isActive: boolean, type: RouteMode): google.maps.PolylineOptions {
  if (!isActive) {
    return {
      strokeColor: '#747884',
      strokeOpacity: 0.32,
      strokeWeight: 3,
      zIndex: 1,
    };
  }

  return {
    strokeColor: type === 'safest' ? '#32c47c' : '#6aa4ff',
    strokeOpacity: 0.96,
    strokeWeight: type === 'safest' ? 7 : 6,
    zIndex: 3,
  };
}

function markerIcon(color: string, stroke: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: stroke,
    strokeWeight: 3,
  };
}

export function GoogleMap({ apiKey, routeData, activeMode, layers, className, onError }: GoogleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const safestPolylineRef = useRef<google.maps.Polyline | null>(null);
  const fastestPolylineRef = useRef<google.maps.Polyline | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);
  const streetlightMarkersRef = useRef<google.maps.Circle[]>([]);
  const idleListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = useState('Loading spatial intelligence...');

  const clearStreetlights = useCallback(() => {
    streetlightMarkersRef.current.forEach((marker) => marker.setMap(null));
    streetlightMarkersRef.current = [];
  }, []);

  const refreshStreetlights = useCallback(async () => {
    const currentMap = mapRef.current;
    if (!currentMap || !layers.streetlights) {
      clearStreetlights();
      return;
    }

    if ((currentMap.getZoom() ?? 0) < 15) {
      clearStreetlights();
      return;
    }

    const bounds = currentMap.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    try {
      const lights = await fetchStreetlights({
        minLat: sw.lat(),
        maxLat: ne.lat(),
        minLng: sw.lng(),
        maxLng: ne.lng(),
      });

      clearStreetlights();
      streetlightMarkersRef.current = lights.slice(0, 1800).map((light: StreetlightPoint) => (
        new google.maps.Circle({
          map: currentMap,
          center: { lat: light.lat, lng: light.lng },
          radius: 7,
          fillColor: '#ffd166',
          fillOpacity: 0.48,
          strokeColor: '#ffefb0',
          strokeOpacity: 0.35,
          strokeWeight: 1,
          clickable: false,
        })
      ));
    } catch (error) {
      clearStreetlights();
      onError?.(error instanceof Error ? error.message : 'Streetlights failed to load.');
    }
  }, [clearStreetlights, layers.streetlights, onError]);

  useEffect(() => {
    if (!containerRef.current || !apiKey) return;
    let cancelled = false;

    async function bootMap() {
      try {
        await loadGoogleMaps(apiKey);
        if (cancelled || !containerRef.current) return;

        const instance = new google.maps.Map(containerRef.current, {
          center: { lat: 43.6532, lng: -79.3832 },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: false,
          clickableIcons: false,
          styles: darkMapStyles(),
          gestureHandling: 'greedy',
          backgroundColor: '#08090d',
        });

        mapRef.current = instance;
        setMap(instance);
        setStatus('ready');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google Maps failed to load.';
        setStatus('error');
        setStatusMessage(message);
        onError?.(message);
      }
    }

    bootMap();

    return () => {
      cancelled = true;
      idleListenerRef.current?.remove();
      mapRef.current = null;
    };
  }, [apiKey, onError]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    transitLayerRef.current ??= new google.maps.TransitLayer();
    transitLayerRef.current.setMap(layers.transit ? currentMap : null);
  }, [layers.transit]);

  useEffect(() => {
    idleListenerRef.current?.remove();
    if (!mapRef.current || !layers.streetlights) {
      clearStreetlights();
      return;
    }

    refreshStreetlights();
    idleListenerRef.current = mapRef.current.addListener('idle', refreshStreetlights);
    return () => idleListenerRef.current?.remove();
  }, [clearStreetlights, layers.streetlights, refreshStreetlights]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    fastestPolylineRef.current?.setOptions(polylineStyle(activeMode === 'fastest', 'fastest'));
    safestPolylineRef.current?.setOptions(polylineStyle(activeMode === 'safest', 'safest'));
  }, [activeMode]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap || !routeData) return;

    fastestPolylineRef.current?.setMap(null);
    safestPolylineRef.current?.setMap(null);
    originMarkerRef.current?.setMap(null);
    destinationMarkerRef.current?.setMap(null);

    const fastestPoints = decodePolyline(routeData.fastest.polyline);
    const safestPoints = decodePolyline(routeData.safest.polyline);

    fastestPolylineRef.current = new google.maps.Polyline({
      map: currentMap,
      path: fastestPoints,
      ...polylineStyle(activeMode === 'fastest', 'fastest'),
    });

    safestPolylineRef.current = new google.maps.Polyline({
      map: currentMap,
      path: safestPoints,
      ...polylineStyle(activeMode === 'safest', 'safest'),
    });

    const bounds = new google.maps.LatLngBounds();
    [...fastestPoints, ...safestPoints].forEach((point) => bounds.extend(point));
    if (!bounds.isEmpty()) {
      currentMap.fitBounds(bounds, { top: 72, right: 56, bottom: 72, left: 430 });
    }

    const origin = fastestPoints[0];
    const destination = fastestPoints[fastestPoints.length - 1];
    if (origin) {
      originMarkerRef.current = new google.maps.Marker({
        position: origin,
        map: currentMap,
        zIndex: 10,
        icon: markerIcon('#f7f7f8', '#0b0c10'),
      });
    }

    if (destination) {
      destinationMarkerRef.current = new google.maps.Marker({
        position: destination,
        map: currentMap,
        zIndex: 10,
        icon: markerIcon('#32c47c', '#f7f7f8'),
      });
    }
  }, [activeMode, routeData]);

  return (
    <div className={cn('relative h-full min-h-[520px] overflow-hidden bg-background', className)}>
      <div ref={containerRef} className="absolute inset-0" />
      <HeatmapLayer map={map} visible={layers.heatmap} onError={onError} />

      {status !== 'ready' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
          <div className="glass mx-6 max-w-sm rounded-xl p-5 text-center">
            {status === 'error' ? (
              <AlertTriangle className="mx-auto mb-3 h-5 w-5 text-danger" />
            ) : (
              <MapPinned className="mx-auto mb-3 h-5 w-5 text-safe" />
            )}
            <p className="text-sm font-medium text-foreground">
              {status === 'error' ? 'Map unavailable' : 'Preparing map'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{statusMessage}</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background/80 to-transparent" />
    </div>
  );
}
