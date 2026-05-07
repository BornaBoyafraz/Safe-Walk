// Amber → orange → muted brick. Peak alpha 0.36 so hotspots are readable
// without flooding the map. Tighter radii keep clusters from bleeding together.
export const HEATMAP_GRADIENT = [
  'rgba(0,0,0,0)',
  'rgba(80,200,100,0)',
  'rgba(100,210,80,0.05)',
  'rgba(180,220,60,0.12)',
  'rgba(240,220,40,0.20)',
  'rgba(245,170,30,0.30)',
  'rgba(235,100,15,0.40)',
  'rgba(210,40,10,0.50)',
];

export interface HeatmapTier {
  radius: number;
  maxIntensity: number;
  opacity: number;
}

// maxIntensity: how many overlapping points saturate the gradient.
// High values at low zoom = only true hotspots (Jane-Finch, Moss Park, etc.)
// show warm colour; the rest of the city stays clean.
export function heatmapTierForZoom(zoom: number): HeatmapTier {
  if (zoom <= 10) return { radius: 16, maxIntensity: 2500, opacity: 0.22 };
  if (zoom <= 12) return { radius: 14, maxIntensity: 1200, opacity: 0.28 };
  if (zoom <= 13) return { radius: 12, maxIntensity:  500, opacity: 0.34 };
  if (zoom <= 15) return { radius:  9, maxIntensity:  150, opacity: 0.42 };
  return               { radius:  6, maxIntensity:   50, opacity: 0.48 };
}
