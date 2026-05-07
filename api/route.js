const fs = require('fs');
const path = require('path');

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

function normalizeAddress(value, field) {
  if (typeof value !== 'string') {
    throw new RouteApiError(`${field} must be a string.`, 400, 'INVALID_ROUTE_REQUEST');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new RouteApiError(`${field} is required.`, 400, 'INVALID_ROUTE_REQUEST');
  }

  return trimmed;
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

function getRoutesApiKey() {
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

// Loaded once and cached in warm function instances
let incidentPoints = null;

function loadIncidents() {
  if (incidentPoints !== null) return incidentPoints;

  try {
    const jsonPath = path.join(process.cwd(), 'public', 'data', 'heatmap.json');
    const raw = fs.readFileSync(jsonPath, 'utf8');
    incidentPoints = JSON.parse(raw);
    console.log(`[route] loaded ${incidentPoints.length} incidents for scoring`);
  } catch (err) {
    incidentPoints = [];
    console.warn('[route] could not load heatmap.json — scoring will use 0:', err.message);
  }

  return incidentPoints;
}

// Bounding-box incident count within ~500m of a point
function scorePoint(lat, lng) {
  const incidents = loadIncidents();
  let count = 0;
  for (const p of incidents) {
    if (Math.abs(p.lat - lat) < 0.0045 && Math.abs(p.lng - lng) < 0.006) {
      count++;
    }
  }
  // 25 incidents in ~500m radius = max score, calibrated to Toronto's density
  return Math.min(count / 25, 1.0);
}

function scoreRoute(points) {
  if (!points || points.length === 0) return { score: 0, dangerousSegments: 0 };
  const costs = points.map(p => scorePoint(p.lat, p.lng));
  const score = costs.reduce((sum, c) => sum + c, 0) / costs.length;
  const dangerousSegments = costs.filter(c => c > 0.5).length;
  return { score, dangerousSegments };
}

// Google encoded polyline algorithm
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

function samplePoints(points, every) {
  const sampled = [];
  for (let i = 0; i < points.length; i += every) {
    sampled.push(points[i]);
  }
  if (points.length > 0 && sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }
  return sampled;
}

async function callGoogleRoutesRequest(body) {
  const apiKey = getRoutesApiKey();
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

function scoreRawRoutes(rawRoutes) {
  return rawRoutes.map((route, index) => {
    if (!route?.polyline?.encodedPolyline) {
      throw new RouteApiError('Google returned a route without an encoded polyline.', 502, 'GOOGLE_ROUTE_POLYLINE_MISSING');
    }

    const allPoints = decodePolyline(route.polyline.encodedPolyline);
    const sampled = allPoints.length > 5 ? samplePoints(allPoints, 5) : allPoints;
    let score;
    let dangerousSegments;

    try {
      ({ score, dangerousSegments } = scoreRoute(sampled));
    } catch (err) {
      logSafeError('database-backed scoring failed, using neutral score', {
        routeIndex: index,
        message: err.message,
      });
      score = 0.5;
      dangerousSegments = 0;
    }

    return {
      polyline: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters,
      duration: route.duration,
      safety_score: parseFloat(score.toFixed(4)),
      dangerous_segments: dangerousSegments,
      google_rank: index,
      _sampled: sampled,
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

  let scored = scoreRawRoutes(rawRoutes);
  logSafe('scored direct routes', { count: scored.length });

  const scoreRange = Math.max(...scored.map(r => r.safety_score))
                   - Math.min(...scored.map(r => r.safety_score));

  if (scored.length <= 1 || scoreRange < 0.05) {
    try {
      const altRaw = await generateAlternatives(origin, destination);
      logSafe('alternative routes returned', { count: altRaw.length });
      const altScored = scoreRawRoutes(altRaw);
      const merged = deduplicateRoutes(altScored);
      if (merged.length > scored.length) {
        scored = merged;
      }
    } catch (err) {
      logSafeError('alternative route generation failed, keeping direct routes', {
        message: err.message,
      });
    }
  }

  const bySafety = [...scored].sort((a, b) => a.safety_score - b.safety_score);

  let fastest = scored.find(r => r.google_rank === 0) || scored[0];
  let safest = bySafety[0];

  if (fastest.polyline === safest.polyline && bySafety.length > 1) {
    fastest = bySafety[1];
  }

  function stripInternal(r) {
    const { _sampled, ...clean } = r;
    return clean;
  }

  return {
    fastest: stripInternal(fastest),
    safest: stripInternal(safest),
    all_routes: bySafety.map(stripInternal),
  };
}

// Vercel handler
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  try {
    const body = parseJsonMaybe(req.body) || {};
    const origin = normalizeAddress(body.origin, 'origin');
    const destination = normalizeAddress(body.destination, 'destination');

    logSafe('route request received', {
      originChars: origin.length,
      destinationChars: destination.length,
    });

    const result = await computeRoutes(origin, destination);
    res.json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    logSafeError('route request failed', {
      code: err.code || 'UNHANDLED_ROUTE_ERROR',
      statusCode,
      message: err.message,
      details: err.details,
    });

    res.status(statusCode).json({
      error: err.message || 'Route computation failed.',
      code: err.code || 'UNHANDLED_ROUTE_ERROR',
      details: err.details,
    });
  }
};
