// Amber -> orange -> muted brick. The top end is intentionally vivid for demo
// readability, but never reaches opaque pure red.
export const HEATMAP_GRADIENT = [
  'rgba(0,0,0,0)',
  'rgba(255,220,120,0)',
  'rgba(255,204,82,0.16)',
  'rgba(255,174,54,0.30)',
  'rgba(255,133,32,0.46)',
  'rgba(238,82,22,0.64)',
  'rgba(204,38,20,0.78)',
  'rgba(144,14,22,0.88)',
];

export interface HeatmapTier {
  key: string;
  radius: number;
  maxIntensity: number;
  opacity: number;
  cellSize: number;
  hotspotLimit: number;
  hotspotMinWeight: number;
  hotspotRadius: number;
}

export function heatmapLayerOptions(tier: HeatmapTier): google.maps.visualization.HeatmapLayerOptions {
  return {
    radius: tier.radius,
    maxIntensity: tier.maxIntensity,
    opacity: tier.opacity,
  };
}

// maxIntensity controls saturation after the client aggregates nearby incidents
// into weighted cells. Lower values make hotspots visible sooner; cellSize keeps
// city-scale views from turning into one broad wash.
export function heatmapTierForZoom(zoom: number): HeatmapTier {
  if (zoom <= 10) {
    return { key: 'city', radius: 20, maxIntensity: 190, opacity: 0.42, cellSize: 0.0045, hotspotLimit: 9, hotspotMinWeight: 34, hotspotRadius: 520 };
  }
  if (zoom <= 12) {
    return { key: 'district', radius: 23, maxIntensity: 130, opacity: 0.50, cellSize: 0.0026, hotspotLimit: 10, hotspotMinWeight: 26, hotspotRadius: 360 };
  }
  if (zoom <= 13) {
    return { key: 'neighbourhood', radius: 21, maxIntensity: 82, opacity: 0.56, cellSize: 0.0017, hotspotLimit: 9, hotspotMinWeight: 20, hotspotRadius: 250 };
  }
  if (zoom <= 15) {
    return { key: 'block', radius: 17, maxIntensity: 42, opacity: 0.62, cellSize: 0.0010, hotspotLimit: 7, hotspotMinWeight: 14, hotspotRadius: 150 };
  }
  return { key: 'street', radius: 12, maxIntensity: 20, opacity: 0.68, cellSize: 0.00055, hotspotLimit: 5, hotspotMinWeight: 9, hotspotRadius: 90 };
}
