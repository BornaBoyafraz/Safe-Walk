// Amber → orange → muted brick. Peak alpha 0.36 so hotspots are readable
// without flooding the map. Tighter radii keep clusters from bleeding together.
export const HEATMAP_GRADIENT = [
  'rgba(0,0,0,0)',
  'rgba(255,230,160,0)',
  'rgba(255,210,120,0.03)',
  'rgba(255,185,80,0.08)',
  'rgba(250,155,45,0.14)',
  'rgba(235,120,20,0.22)',
  'rgba(210,80,10,0.30)',
  'rgba(175,50,5,0.36)',
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
