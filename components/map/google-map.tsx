'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, MapPinned } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type RouteResult } from '@/lib/api-client';
import { browserKeyMissingMessage } from '@/lib/google-maps-errors';
import { loadGoogleMaps } from '@/lib/google-maps-loader';
import { darkMapStyles } from '@/lib/map-style';
import { decodePolyline } from '@/lib/polyline';
import { HeatmapLayer } from './heatmap-layer';

export type RouteMode = 'alternate' | 'fastest';

export interface MapLayers {
  heatmap: boolean;
}

export interface MapFocusLocation {
  role: 'origin' | 'destination';
  label: string;
  location: { lat: number; lng: number } | null;
}

interface GoogleMapProps {
  apiKey: string | null;
  routeData: RouteResult | null;
  activeMode: RouteMode;
  layers: MapLayers;
  focusLocation?: MapFocusLocation | null;
  className?: string;
  onError?: (message: string) => void;
}

function polylineStyle(isActive: boolean, type: RouteMode): google.maps.PolylineOptions {
  if (!isActive) {
    return {
      strokeColor: '#5a5e6a',
      strokeOpacity: 0.22,
      strokeWeight: 2.5,
      zIndex: 1,
    };
  }

  return {
    strokeColor: type === 'alternate' ? '#2fb872' : '#5a9ef8',
    strokeOpacity: 0.95,
    strokeWeight: type === 'alternate' ? 8 : 6,
    zIndex: 3,
    icons: [
      {
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.55, scale: 3 },
        offset: '0',
        repeat: '16px',
      },
    ],
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

function routeBoundsPadding(): google.maps.Padding {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return { top: 64, right: 32, bottom: 330, left: 32 };
  }

  return { top: 72, right: 56, bottom: 72, left: 430 };
}

export function GoogleMap({ apiKey, routeData, activeMode, layers, focusLocation, className, onError }: GoogleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const alternatePolylineRef = useRef<google.maps.Polyline | null>(null);
  const fastestPolylineRef = useRef<google.maps.Polyline | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = useState('Loading map configuration...');

  useEffect(() => {
    if (!containerRef.current) return;

    if (apiKey === null) {
      setStatus('loading');
      setStatusMessage('Loading map configuration...');
      return;
    }

    const browserKey = apiKey.trim();

    if (!browserKey) {
      const message = browserKeyMissingMessage();
      setStatus('error');
      setStatusMessage(message);
      onError?.(message);
      console.error('[Safe Walk] Google Maps configuration missing:', message);
      return;
    }

    let cancelled = false;
    let idleTimeout: number | null = null;

    async function bootMap() {
      try {
        setStatus('loading');
        setStatusMessage('Loading Google Maps...');
        await loadGoogleMaps(browserKey);
        if (cancelled || !containerRef.current) return;

        if (containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) {
          throw new Error('Google Maps container has no visible size. Check the demo layout container.');
        }

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

        idleTimeout = window.setTimeout(() => {
          console.warn('[Safe Walk] Google Map created but did not reach idle quickly.', {
            center: instance.getCenter()?.toJSON(),
            zoom: instance.getZoom(),
          });
        }, 7000);

        google.maps.event.addListenerOnce(instance, 'idle', () => {
          if (idleTimeout) {
            window.clearTimeout(idleTimeout);
            idleTimeout = null;
          }
          console.info('[Safe Walk] Google Map initialized.', {
            center: instance.getCenter()?.toJSON(),
            zoom: instance.getZoom(),
          });
        });

        mapRef.current = instance;
        setMap(instance);
        setStatus('ready');
        setStatusMessage('Map ready.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Google Maps failed to load.';
        setStatus('error');
        setStatusMessage(message);
        console.error('[Safe Walk] Map initialization failed:', error);
        onError?.(message);
      }
    }

    bootMap();

    return () => {
      cancelled = true;
      if (idleTimeout) window.clearTimeout(idleTimeout);
      mapRef.current = null;
    };
  }, [apiKey, onError]);

  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap) return;

    fastestPolylineRef.current?.setOptions(polylineStyle(activeMode === 'fastest', 'fastest'));
    alternatePolylineRef.current?.setOptions(polylineStyle(activeMode === 'alternate', 'alternate'));
  }, [activeMode]);

  useEffect(() => {
    const currentMap = map;
    if (!currentMap) return;

    fastestPolylineRef.current?.setMap(null);
    alternatePolylineRef.current?.setMap(null);
    originMarkerRef.current?.setMap(null);
    destinationMarkerRef.current?.setMap(null);

    fastestPolylineRef.current = null;
    alternatePolylineRef.current = null;
    originMarkerRef.current = null;
    destinationMarkerRef.current = null;

    if (!routeData) return;

    let fastestPoints;
    let alternatePoints;
    try {
      fastestPoints = decodePolyline(routeData.fastest.polyline);
      alternatePoints = decodePolyline(routeData.alternate.polyline);
    } catch (error) {
      const message = 'Route polyline could not be decoded.';
      console.error('[Safe Walk] Route rendering failed:', error);
      onError?.(message);
      return;
    }

    if (fastestPoints.length === 0 || alternatePoints.length === 0) {
      onError?.('Route API returned an empty route polyline.');
      return;
    }

    fastestPolylineRef.current = new google.maps.Polyline({
      map: currentMap,
      path: fastestPoints,
      ...polylineStyle(activeMode === 'fastest', 'fastest'),
    });

    alternatePolylineRef.current = new google.maps.Polyline({
      map: currentMap,
      path: alternatePoints,
      ...polylineStyle(activeMode === 'alternate', 'alternate'),
    });

    const bounds = new google.maps.LatLngBounds();
    [...fastestPoints, ...alternatePoints].forEach((point) => bounds.extend(point));
    if (!bounds.isEmpty()) {
      currentMap.fitBounds(bounds, routeBoundsPadding());
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
  }, [activeMode, map, onError, routeData]);

  useEffect(() => {
    if (!map || !focusLocation?.location || routeData) return;

    const center = focusLocation.location;
    console.info('[Safe Walk] Centering map on selected place.', {
      role: focusLocation.role,
      labelChars: focusLocation.label.length,
      lat: Number(center.lat.toFixed(5)),
      lng: Number(center.lng.toFixed(5)),
    });
    map.panTo(center);
    if ((map.getZoom() ?? 0) < 14) {
      map.setZoom(14);
    }
  }, [focusLocation, map, routeData]);

  useEffect(() => {
    return () => {
      fastestPolylineRef.current?.setMap(null);
      alternatePolylineRef.current?.setMap(null);
      originMarkerRef.current?.setMap(null);
      destinationMarkerRef.current?.setMap(null);
    };
  }, []);

  return (
    <div className={cn('relative h-full min-h-[520px] overflow-hidden bg-background', className)}>
      <div ref={containerRef} className="absolute inset-0" />
      <HeatmapLayer map={map} visible={layers.heatmap} onError={onError} />

      {/* Data attribution */}
      {status === 'ready' && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden md:block">
          <div className="glass rounded-lg px-2.5 py-1 text-[10px] text-muted-foreground/60">
            Safety data: Toronto Police Open Data
          </div>
        </div>
      )}

      {status !== 'ready' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="glass mx-6 max-w-xs rounded-2xl p-5 text-center">
            {status === 'error' ? (
              <AlertTriangle className="mx-auto mb-3 h-5 w-5 text-danger" />
            ) : (
              <MapPinned className="mx-auto mb-3 h-5 w-5 text-safe" />
            )}
            <p className="text-sm font-semibold text-foreground">
              {status === 'error' ? 'Map unavailable' : 'Preparing map'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{statusMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
