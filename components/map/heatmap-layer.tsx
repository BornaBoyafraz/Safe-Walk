'use client';

import { useEffect, useRef } from 'react';
import { fetchHeatmapData } from '@/lib/api-client';
import { HEATMAP_GRADIENT, heatmapTierForZoom } from '@/lib/heatmap-config';

interface HeatmapLayerProps {
  map: google.maps.Map | null;
  visible: boolean;
  onError?: (message: string) => void;
}

export function HeatmapLayer({ map, visible, onError }: HeatmapLayerProps) {
  const layerRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const pointsRef = useRef<google.maps.LatLng[] | null>(null);
  const zoomListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!map) return;
    const currentMap = map;

    let cancelled = false;

    async function ensureLayer() {
      try {
        if (!pointsRef.current) {
          const points = await fetchHeatmapData();
          if (cancelled) return;
          if (!Array.isArray(points)) {
            throw new Error('Heatmap API returned an invalid payload.');
          }
          pointsRef.current = points.map((point) => new google.maps.LatLng(point.lat, point.lng));
        }

        const tier = heatmapTierForZoom(currentMap.getZoom() ?? 12);
        if (!layerRef.current) {
          if (!google.maps.visualization?.HeatmapLayer) {
            throw new Error('Google Maps visualization library is unavailable. Check Maps JavaScript API restrictions.');
          }

          layerRef.current = new google.maps.visualization.HeatmapLayer({
            data: pointsRef.current,
            map: currentMap,
            gradient: HEATMAP_GRADIENT,
            dissipating: true,
            ...tier,
            opacity: 0,
          });
        }

        if (fadeTimerRef.current) {
          clearTimeout(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }

        layerRef.current.setMap(currentMap);
        layerRef.current.setOptions({ ...tier, opacity: tier.opacity });

        if (!zoomListenerRef.current) {
          let raf = 0;
          zoomListenerRef.current = currentMap.addListener('zoom_changed', () => {
            if (!layerRef.current || !layerRef.current.getMap()) return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
              const nextTier = heatmapTierForZoom(currentMap.getZoom() ?? 12);
              layerRef.current?.setOptions(nextTier);
            });
          });
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Heatmap failed to load.';
          console.error('[Safe Walk] Heatmap layer failed:', error);
          onError?.(message);
        }
      }
    }

    if (visible) {
      ensureLayer();
    } else if (layerRef.current) {
      layerRef.current.setOptions({ opacity: 0 });
      fadeTimerRef.current = setTimeout(() => layerRef.current?.setMap(null), 180);
    }

    return () => {
      cancelled = true;
    };
  }, [map, onError, visible]);

  useEffect(() => {
    return () => {
      zoomListenerRef.current?.remove();
      layerRef.current?.setMap(null);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  return null;
}
