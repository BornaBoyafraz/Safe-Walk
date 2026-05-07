'use client';

import { useEffect, useRef } from 'react';
import { fetchHeatmapData, type HeatmapPoint } from '@/lib/api-client';
import { HEATMAP_GRADIENT, heatmapLayerOptions, heatmapTierForZoom, type HeatmapTier } from '@/lib/heatmap-config';

interface HeatmapLayerProps {
  map: google.maps.Map | null;
  visible: boolean;
  onError?: (message: string) => void;
}

export function HeatmapLayer({ map, visible, onError }: HeatmapLayerProps) {
  const layerRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const pointsRef = useRef<HeatmapPoint[] | null>(null);
  const bundleCacheRef = useRef<Map<string, HeatmapBundle>>(new Map());
  const activeTierKeyRef = useRef<string | null>(null);
  const hotspotCirclesRef = useRef<google.maps.Circle[]>([]);
  const hotspotBaseRadiiRef = useRef<number[]>([]);
  const pulseFrameRef = useRef<number | null>(null);
  const zoomListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  function stopHotspotPulse() {
    if (pulseFrameRef.current) {
      cancelAnimationFrame(pulseFrameRef.current);
      pulseFrameRef.current = null;
    }
  }

  function clearHotspotRings() {
    stopHotspotPulse();
    hotspotCirclesRef.current.forEach((circle) => circle.setMap(null));
    hotspotCirclesRef.current = [];
    hotspotBaseRadiiRef.current = [];
  }

  function startHotspotPulse(tier: HeatmapTier) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const tick = () => {
      const phase = (Math.sin(Date.now() / 950) + 1) / 2;
      hotspotCirclesRef.current.forEach((circle, index) => {
        const baseRadius = hotspotBaseRadiiRef.current[index] || tier.hotspotRadius;
        circle.setRadius(baseRadius * (1 + phase * 0.08));
        circle.setOptions({
          fillOpacity: 0.055 + phase * 0.035,
          strokeOpacity: 0.12 + phase * 0.07,
        });
      });
      pulseFrameRef.current = requestAnimationFrame(tick);
    };

    pulseFrameRef.current = requestAnimationFrame(tick);
  }

  function syncHotspotRings(currentMap: google.maps.Map, bundle: HeatmapBundle, tier: HeatmapTier) {
    clearHotspotRings();

    hotspotCirclesRef.current = bundle.hotspots.map((hotspot, index) => {
      const radius = tier.hotspotRadius * Math.max(0.7, Math.min(1.45, hotspot.weight / Math.max(tier.hotspotMinWeight, 1)));
      hotspotBaseRadiiRef.current[index] = radius;
      return new google.maps.Circle({
        map: currentMap,
        center: hotspot.location,
        radius,
        clickable: false,
        strokeColor: '#ffb14a',
        strokeOpacity: 0.14,
        strokeWeight: 1,
        fillColor: '#ef4f1f',
        fillOpacity: 0.06,
        zIndex: 2,
      });
    });

    if (hotspotCirclesRef.current.length > 0) {
      startHotspotPulse(tier);
    }
  }

  function buildBundle(tier: HeatmapTier): HeatmapBundle {
    const cached = bundleCacheRef.current.get(tier.key);
    if (cached) return cached;

    const source = pointsRef.current || [];
    const cells = new Map<string, HeatmapCell>();

    for (const point of source) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;

      const pointWeight = incidentWeight(point);
      const latKey = Math.round(point.lat / tier.cellSize);
      const lngKey = Math.round(point.lng / tier.cellSize);
      const key = `${latKey}:${lngKey}`;
      const cell = cells.get(key) || { latSum: 0, lngSum: 0, weightSum: 0, count: 0 };

      cell.latSum += point.lat * pointWeight;
      cell.lngSum += point.lng * pointWeight;
      cell.weightSum += pointWeight;
      cell.count += 1;
      cells.set(key, cell);
    }

    const aggregated = Array.from(cells.values()).map((cell) => {
      const densityBoost = Math.pow(cell.weightSum, 0.74) * 1.45;
      const countBoost = Math.min(cell.count, 8) * 0.16;
      const weight = Math.max(1, Math.min(tier.maxIntensity * 0.86, densityBoost + countBoost));

      return {
        location: new google.maps.LatLng(cell.latSum / cell.weightSum, cell.lngSum / cell.weightSum),
        weight: Number(weight.toFixed(2)),
        count: cell.count,
      };
    });

    const hotspots = aggregated
      .filter((cell) => cell.weight >= tier.hotspotMinWeight)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, tier.hotspotLimit);

    const bundle = {
      data: aggregated.map(({ location, weight }) => ({ location, weight })),
      hotspots,
    };

    bundleCacheRef.current.set(tier.key, bundle);
    console.info('[Safe Walk] Heatmap data prepared.', {
      tier: tier.key,
      rawPoints: source.length,
      weightedCells: bundle.data.length,
      hotspots: hotspots.length,
    });

    return bundle;
  }

  function applyTier(currentMap: google.maps.Map) {
    if (!layerRef.current) return;

    const tier = heatmapTierForZoom(currentMap.getZoom() ?? 12);
    const bundle = buildBundle(tier);

    if (activeTierKeyRef.current !== tier.key) {
      layerRef.current.setData(bundle.data);
      syncHotspotRings(currentMap, bundle, tier);
      activeTierKeyRef.current = tier.key;
    }

    layerRef.current.setOptions(heatmapLayerOptions(tier));
  }

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
          pointsRef.current = points;
          bundleCacheRef.current.clear();
          console.info('[Safe Walk] Heatmap API loaded.', { points: points.length });
        }

        const tier = heatmapTierForZoom(currentMap.getZoom() ?? 12);
        const bundle = buildBundle(tier);
        if (!layerRef.current) {
          if (!google.maps.visualization?.HeatmapLayer) {
            throw new Error('Google Maps visualization library is unavailable. Check Maps JavaScript API restrictions.');
          }

          layerRef.current = new google.maps.visualization.HeatmapLayer({
            data: bundle.data,
            map: currentMap,
            gradient: HEATMAP_GRADIENT,
            dissipating: true,
            ...heatmapLayerOptions(tier),
            opacity: 0,
          });
          activeTierKeyRef.current = tier.key;
        }

        if (fadeTimerRef.current) {
          clearTimeout(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }

        layerRef.current.setMap(currentMap);
        layerRef.current.setOptions({ ...heatmapLayerOptions(tier), opacity: tier.opacity });
        if (activeTierKeyRef.current !== tier.key) {
          layerRef.current.setData(bundle.data);
          activeTierKeyRef.current = tier.key;
        }
        syncHotspotRings(currentMap, bundle, tier);

        if (!zoomListenerRef.current) {
          let raf = 0;
          zoomListenerRef.current = currentMap.addListener('zoom_changed', () => {
            if (!visibleRef.current || !layerRef.current || !layerRef.current.getMap()) return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
              applyTier(currentMap);
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
      clearHotspotRings();
      fadeTimerRef.current = setTimeout(() => layerRef.current?.setMap(null), 180);
    }

    return () => {
      cancelled = true;
    };
  }, [map, onError, visible]);

  useEffect(() => {
    return () => {
      zoomListenerRef.current?.remove();
      clearHotspotRings();
      layerRef.current?.setMap(null);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  return null;
}

interface HeatmapCell {
  latSum: number;
  lngSum: number;
  weightSum: number;
  count: number;
}

interface HotspotCell {
  location: google.maps.LatLng;
  weight: number;
  count: number;
}

interface HeatmapBundle {
  data: google.maps.visualization.WeightedLocation[];
  hotspots: HotspotCell[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function incidentWeight(point: HeatmapPoint) {
  if (Number.isFinite(point.weight)) {
    return clamp(Number(point.weight), 0.7, 3.6);
  }

  const text = `${point.category || ''} ${point.offence || ''}`.toLowerCase();
  if (/homicide|shooting|firearm|sexual|weapon|mugging|robbery/.test(text)) return 3.1;
  if (/assault bodily harm|assault with weapon/.test(text)) return 2.6;
  if (/assault/.test(text)) return 1.9;
  if (/break|enter|b&e/.test(text)) return 1.35;
  if (/theft over|auto theft|motor vehicle/.test(text)) return 1.15;
  return 1;
}
