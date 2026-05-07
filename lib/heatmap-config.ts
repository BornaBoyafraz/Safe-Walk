export const HEATMAP_GRADIENT = [
  'rgba(0,0,0,0)',
  'rgba(255,200,100,0)',
  'rgba(255,170,60,0.10)',
  'rgba(255,140,20,0.22)',
  'rgba(255,100,0,0.38)',
  'rgba(225,55,0,0.55)',
  'rgba(185,20,0,0.72)',
  'rgba(140,0,0,0.85)',
];

export interface HeatmapTier {
  radius: number;
  maxIntensity: number;
  opacity: number;
}

export function heatmapTierForZoom(zoom: number): HeatmapTier {
  if (zoom <= 11) return { radius: 14, maxIntensity: 150, opacity: 0.40 };
  if (zoom <= 13) return { radius: 18, maxIntensity:  80, opacity: 0.48 };
  if (zoom <= 15) return { radius: 16, maxIntensity:  38, opacity: 0.56 };
  return               { radius: 11, maxIntensity:  16, opacity: 0.65 };
}
