const { getTorontoHour, scoreRoute } = require('./safety-score');

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

function neutralScoring() {
  return {
    score: 0.5,
    dangerousSegments: 0,
    crimeRisk: 0,
    lightingRisk: 0.5,
    communityRisk: 0,
    timeOfDayMultiplier: 1,
    confidenceScore: 0.2,
    explanation: {
      mainFactors: ['Scoring data was unavailable for this route.'],
      confidence: 'low',
    },
    breakdown: {
      crimeRisk: 0,
      lightingRisk: 0.5,
      communityRisk: 0,
      timeWindow: 'unknown',
      incidentsConsidered: 0,
      streetlightsConsidered: 0,
      communityReportsConsidered: 0,
    },
    sampledPoints: [],
  };
}

function roundRouteScore(value) {
  return parseFloat(Math.max(0, Math.min(1, value)).toFixed(4));
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
      'Google Routes API key not configured. Set GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.',
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

async function scoreRawRoutes(rawRoutes, hour) {
  return Promise.all(rawRoutes.map(async (route, index) => {
    if (!route?.polyline?.encodedPolyline) {
      throw new RouteApiError('Google returned a route without an encoded polyline.', 502, 'GOOGLE_ROUTE_POLYLINE_MISSING');
    }

    const allPoints = decodePolyline(route.polyline.encodedPolyline);
    let scoring;

    try {
      scoring = scoreRoute(allPoints, { hour });
    } catch (err) {
      logSafeError('database-backed scoring failed, using neutral score', {
        routeIndex: index,
        message: err.message,
      });
      scoring = neutralScoring();
    }

    const safetyScore = roundRouteScore(scoring.score);

    return {
      polyline: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters,
      duration: route.duration,
      safety_score: safetyScore,
      safetyScore,
      dangerous_segments: scoring.dangerousSegments,
      crimeRisk: roundRouteScore(scoring.crimeRisk),
      lightingRisk: roundRouteScore(scoring.lightingRisk),
      communityRisk: roundRouteScore(scoring.communityRisk),
      timeOfDayMultiplier: Number(scoring.timeOfDayMultiplier.toFixed(2)),
      confidenceScore: roundRouteScore(scoring.confidenceScore),
      explanation: scoring.explanation,
      score_breakdown: scoring.breakdown,
      google_rank: index,
      _sampled: scoring.sampledPoints.length > 0 ? scoring.sampledPoints : allPoints,
    };
  }));
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
  const hour = getTorontoHour();
  let rawRoutes = await callGoogleRoutes(origin, destination);

  if (rawRoutes.length === 0) {
    throw new RouteApiError('Google Routes could not find a route between these addresses.', 422, 'GOOGLE_ROUTES_EMPTY');
  }

  let scored = await scoreRawRoutes(rawRoutes, hour);
  logSafe('scored direct routes', { count: scored.length });

  const scoreRange = Math.max(...scored.map(r => r.safety_score))
                   - Math.min(...scored.map(r => r.safety_score));

  if (scored.length <= 1 || scoreRange < 0.05) {
    try {
      const altRaw = await generateAlternatives(origin, destination);
      logSafe('alternative routes returned', { count: altRaw.length });
      const altScored = await scoreRawRoutes(altRaw, hour);
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

  // Guarantee two visually different routes for the demo
  if (fastest.polyline === safest.polyline && bySafety.length > 1) {
    fastest = bySafety[1];
  }

  // Strip internal field before sending to client
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

module.exports = { computeRoutes, RouteApiError };
