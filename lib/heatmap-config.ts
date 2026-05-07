// Amber → orange → muted brick. Capped at ~0.46 alpha so the map stays legible
// and no area looks uniformly dangerous. Only genuine hotspots reach the warmer end.
export const HEATMAP_GRADIENT = [
  'rgba(0,0,0,0)',
  'rgba(255,225,140,0)',
  'rgba(255,205,110,0.05)',
  'rgba(255,180,70,0.12)',
  'rgba(252,150,40,0.20)',
  'rgba(238,115,18,0.28)',
  'rgba(210,78,8,0.36)',
  'rgba(172,45,4,0.44)',
];

export interface HeatmapTier {
  radius: number;
  maxIntensity: number;
  opacity: number;
}

// maxIntensity controls how many overlapping points are needed to hit peak saturation.
// High values at low zoom = only true hotspots reach max; suburbs stay amber.
export function heatmapTierForZoom(zoom: number): HeatmapTier {
  if (zoom <= 10) return { radius: 22, maxIntensity: 1400, opacity: 0.30 };
  if (zoom <= 12) return { radius: 18, maxIntensity:  650, opacity: 0.36 };
  if (zoom <= 13) return { radius: 16, maxIntensity:  240, opacity: 0.42 };
  if (zoom <= 15) return { radius: 12, maxIntensity:   70, opacity: 0.50 };
  return               { radius:  8, maxIntensity:   22, opacity: 0.56 };
}
