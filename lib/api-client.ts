const BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export interface RouteResult {
  fastest: RouteOption;
  safest: RouteOption;
}

export interface RouteOption {
  polyline: string;
  duration: number;
  distance: number;
  safetyScore: number;
  warnings?: string[];
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
}

export async function fetchRoute(origin: string, destination: string): Promise<RouteResult> {
  const params = new URLSearchParams({ origin, destination });
  const res = await fetch(`${BASE}/api/route?${params}`);
  if (!res.ok) throw new Error(`Route API error ${res.status}`);
  return res.json();
}

export async function fetchHeatmapData(): Promise<HeatmapPoint[]> {
  const res = await fetch(`${BASE}/api/incidents/heatmap`);
  if (!res.ok) throw new Error(`Heatmap API error ${res.status}`);
  return res.json();
}

export async function fetchStreetlights(bounds: {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
}): Promise<Array<{ lat: number; lng: number; wattage?: number }>> {
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLng: String(bounds.minLng),
    maxLng: String(bounds.maxLng),
  });
  const res = await fetch(`${BASE}/api/streetlights?${params}`);
  if (!res.ok) throw new Error(`Streetlights API error ${res.status}`);
  return res.json();
}

export async function fetchConfig(): Promise<{ googleMapsApiKey: string }> {
  const res = await fetch(`${BASE}/api/config`);
  if (!res.ok) throw new Error(`Config API error ${res.status}`);
  return res.json();
}
