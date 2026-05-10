export interface LatLngPoint {
  lat: number;
  lng: number;
}

export function decodePolyline(encoded: string): LatLngPoint[] {
  const points: LatLngPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

export function durationToMinutes(duration: string): number {
  const seconds = Number.parseInt(duration, 10);
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(1, Math.round(seconds / 60));
}

export function metersToKm(meters: number): number {
  return meters / 1000;
}

export function dangerToSafetyPercent(safetyScore: number): number {
  return Math.max(0, Math.min(100, Math.round(safetyScore * 100)));
}
