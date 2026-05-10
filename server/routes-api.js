const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const FIELD_MASK = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';

class RouteApiError extends Error {
  constructor(message, statusCode = 502, code = 'ROUTE_API_ERROR', details = undefined) {
    super(message);
    this.name = 'RouteApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function logSafe(event, meta = {}) {
  console.log(`[route] ${event}`, meta);
}

function logSafeError(event, meta = {}) {
  console.error(`[route] ${event}`, meta);
}

function parseJsonMaybe(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

function summarizeGoogleError(status, text) {
  const parsed = parseJsonMaybe(text);
  const error = parsed?.error;
  return {
    status,
    code: error?.status || error?.code || undefined,
    message: error?.message || text.slice(0, 500),
  };
}

function googleErrorToClientError(summary) {
  const message = String(summary.message || '');
  const status = Number(summary.status);
  const code = String(summary.code || '').toUpperCase();
  const lower = message.toLowerCase();

  if (status === 400 || code === 'INVALID_ARGUMENT') {
    return new RouteApiError(
      'Google Routes could not parse one of the addresses. Try adding a city name, for example "Union Station, Toronto".',
      422,
      'GOOGLE_ROUTES_INVALID_ARGUMENT',
      summary,
    );
  }

  if (status === 403 || code === 'PERMISSION_DENIED' || lower.includes('api key') || lower.includes('permission')) {
    return new RouteApiError(
      'Google Routes API rejected the key. Enable Routes API and check the key application/API restrictions in Google Cloud Console.',
      503,
      'GOOGLE_ROUTES_KEY_REJECTED',
      summary,
    );
  }

  if (status === 429 || lower.includes('quota')) {
    return new RouteApiError(
      'Google Routes API quota was exceeded or rate-limited.',
      503,
      'GOOGLE_ROUTES_QUOTA',
      summary,
    );
  }

  return new RouteApiError(
    `Google Routes API returned ${status}.`,
    502,
    'GOOGLE_ROUTES_UPSTREAM_ERROR',
    summary,
  );
}

function summarizeRoutesPayload(body) {
  return {
    originChars: body.origin?.address?.length ?? 0,
    destinationChars: body.destination?.address?.length ?? 0,
    travelMode: body.travelMode,
    computeAlternativeRoutes: Boolean(body.computeAlternativeRoutes),
    intermediateCount: Array.isArray(body.intermediates) ? body.intermediates.length : 0,
  };
}

// Google encoded polyline algorithm — stable spec since 2006, no library needed
function decodePolyline(encoded) {
  const points = [];
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

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function getApiKey() {
  const candidates = [
    ['GOOGLE_MAPS_API_KEY', process.env.GOOGLE_MAPS_API_KEY],
    ['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY],
  ];

  const match = candidates.find(([, value]) => value && value !== 'placeholder_add_key_later');
  logSafe('api key check', {
    hasGoogleMapsKey: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    hasNextPublicKey: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
    selected: match?.[0] || 'missing',
    keyLength: match?.[1]?.length || 0,
  });

  if (!match) {
    throw new RouteApiError(
      'Google Routes API key not configured. Set GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel environment variables.',
      503,
      'GOOGLE_ROUTES_KEY_MISSING',
    );
  }

  return match[1];
}

async function callGoogleRoutesRequest(body) {
  const apiKey = getApiKey();
  logSafe('calling Google Routes API', summarizeRoutesPayload(body));

  const res = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    const summary = summarizeGoogleError(res.status, text);
    logSafeError('Google Routes API failed', summary);
    throw googleErrorToClientError(summary);
  }

  const data = await res.json();
  const routes = data.routes || [];
  logSafe('Google Routes API returned routes', { count: routes.length });
  return routes;
}

async function callGoogleRoutes(origin, destination) {
  return callGoogleRoutesRequest({
    origin: { address: origin },
    destination: { address: destination },
    travelMode: 'WALK',
    computeAlternativeRoutes: true,
  });
}

async function callGoogleRoutesWithWaypoint(origin, destination, waypoint) {
  return callGoogleRoutesRequest({
    origin: { address: origin },
    destination: { address: destination },
    travelMode: 'WALK',
    computeAlternativeRoutes: false,
    intermediates: [{ location: { latLng: { latitude: waypoint.lat, longitude: waypoint.lng } } }],
  });
}

// Two routes overlap if 90%+ of sampledA's points are within ~50m of any point in sampledB
function routesAreDuplicate(sampledA, sampledB) {
  if (sampledA.length === 0 || sampledB.length === 0) return false;
  let matches = 0;
  for (const a of sampledA) {
    if (sampledB.some(b => Math.abs(a.lat - b.lat) < 0.0005 && Math.abs(a.lng - b.lng) < 0.0005)) {
      matches++;
    }
  }
  return matches / sampledA.length > 0.9;
}

async function generateAlternatives(origin, destination) {
  const directRoutes = await callGoogleRoutes(origin, destination);
  if (directRoutes.length === 0) throw new Error('No route found.');

  const directPoints = decodePolyline(directRoutes[0].polyline.encodedPolyline);
  const mid = directPoints[Math.floor(directPoints.length / 2)];

  // ~450m north/south, ~380m east/west at Toronto's latitude
  const offsets = [
    { lat: mid.lat + 0.004, lng: mid.lng },
    { lat: mid.lat - 0.004, lng: mid.lng },
    { lat: mid.lat, lng: mid.lng + 0.005 },
    { lat: mid.lat, lng: mid.lng - 0.005 },
  ];

  const results = await Promise.allSettled(
    offsets.map(wp => callGoogleRoutesWithWaypoint(origin, destination, wp))
  );

  const allRoutes = [...directRoutes];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allRoutes.push(result.value[0]);
    }
  }

  return allRoutes;
}

function normalizeRawRoutes(rawRoutes) {
  return rawRoutes.map((route, index) => {
    if (!route?.polyline?.encodedPolyline) {
      throw new RouteApiError('Google returned a route without an encoded polyline.', 502, 'GOOGLE_ROUTE_POLYLINE_MISSING');
    }

    const allPoints = decodePolyline(route.polyline.encodedPolyline);

    return {
      polyline: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters,
      duration: route.duration,
      google_rank: index,
      _sampled: allPoints,
    };
  });
}

function deduplicateRoutes(routes) {
  const unique = [];
  for (const route of routes) {
    const isDupe = unique.some(existing => {
      if (existing.polyline === route.polyline) return true;
      return routesAreDuplicate(existing._sampled, route._sampled);
    });
    if (!isDupe) unique.push(route);
  }
  return unique;
}

async function computeRoutes(origin, destination) {
  let rawRoutes = await callGoogleRoutes(origin, destination);

  if (rawRoutes.length === 0) {
    throw new RouteApiError('Google Routes could not find a route between these addresses.', 422, 'GOOGLE_ROUTES_EMPTY');
  }

  let routes = deduplicateRoutes(normalizeRawRoutes(rawRoutes));
  logSafe('normalized direct routes', { count: routes.length });

  if (routes.length <= 1) {
    try {
      const altRaw = await generateAlternatives(origin, destination);
      logSafe('alternative routes returned', { count: altRaw.length });
      const merged = deduplicateRoutes(normalizeRawRoutes(altRaw));
      if (merged.length > routes.length) {
        routes = merged;
      }
    } catch (err) {
      logSafeError('alternative route generation failed, keeping direct routes', {
        message: err.message,
      });
    }
  }

  const byDuration = [...routes].sort((a, b) => (parseInt(a.duration, 10) || Infinity) - (parseInt(b.duration, 10) || Infinity));
  const fastest = routes.find(r => r.google_rank === 0) || byDuration[0] || routes[0];
  const alternate = routes.find(r => r.polyline !== fastest.polyline) || fastest;

  // Strip internal field before sending to client
  function stripInternal(r) {
    const { _sampled, ...clean } = r;
    return clean;
  }

  return {
    fastest: stripInternal(fastest),
    alternate: stripInternal(alternate),
    all_routes: routes.map(stripInternal),
  };
}

module.exports = { computeRoutes, RouteApiError };
