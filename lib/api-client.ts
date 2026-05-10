const BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export interface RouteResult {
  fastest: RouteOption;
  alternate: RouteOption;
  all_routes?: RouteOption[];
}

export interface RouteOption {
  polyline: string;
  duration: string;
  distanceMeters: number;
  google_rank?: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight?: number;
  category?: string;
  offence?: string;
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


export interface MapsConfig {
  googleMapsApiKey: string;
  source?: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY' | 'GOOGLE_MAPS_API_KEY_ONE_KEY_FALLBACK' | 'missing';
}

export async function fetchConfig(): Promise<MapsConfig> {
  const res = await fetch(`${BASE}/api/config`);
  if (!res.ok) throw new Error(`Config API error ${res.status}`);
  return res.json();
}
