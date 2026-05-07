const BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export interface RouteResult {
  fastest: RouteOption;
  safest: RouteOption;
  all_routes?: RouteOption[];
}

export interface RouteOption {
  polyline: string;
  duration: string;
  distanceMeters: number;
  safety_score: number;
  dangerous_segments?: number;
  google_rank?: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
}

export interface StreetlightPoint {
  lat: number;
  lng: number;
  type?: string;
  wattage?: number;
  status?: string;
}

export async function fetchRoute(origin: string, destination: string): Promise<RouteResult> {
  const res = await fetch(`${BASE}/api/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Route API error ${res.status}`);
  }
  return res.json();
}

export async function fetchHeatmapData(): Promise<HeatmapPoint[]> {
  const res = await fetch(`${BASE}/api/incidents/heatmap`);
  if (!res.ok) throw new Error(`Heatmap API error ${res.status}`);
  return res.json();
}

export async function fetchStreetlights(bounds: {
  minLat: number; maxLat: number; minLng: number; maxLng: number;
}): Promise<StreetlightPoint[]> {
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLng: String(bounds.minLng),
    maxLng: String(bounds.maxLng),
  });
  const res = await fetch(`${BASE}/api/streetlights?${params}`);
  if (!res.ok) throw new Error(`Streetlights API error ${res.status}`);
  const data = await res.json();
  return (data.features || []).map((feature: {
    geometry?: { coordinates?: [number, number] };
    properties?: Record<string, unknown>;
  }) => ({
    lng: feature.geometry?.coordinates?.[0] ?? 0,
    lat: feature.geometry?.coordinates?.[1] ?? 0,
    type: feature.properties?.type as string | undefined,
    wattage: feature.properties?.wattage as number | undefined,
    status: feature.properties?.status as string | undefined,
  })).filter((point: StreetlightPoint) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

export interface MapsConfig {
  googleMapsApiKey: string;
  source?: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY' | 'GOOGLE_MAPS_API_KEY_DEV_FALLBACK' | 'missing';
}

export async function fetchConfig(): Promise<MapsConfig> {
  const res = await fetch(`${BASE}/api/config`);
  if (!res.ok) throw new Error(`Config API error ${res.status}`);
  return res.json();
}
