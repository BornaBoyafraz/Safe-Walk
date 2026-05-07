const fs = require('fs');
const path = require('path');

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

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

function getApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'placeholder_add_key_later') {
    throw new Error('Google Maps API key not configured. Set GOOGLE_MAPS_API_KEY in Vercel environment variables.');
  }
  return apiKey;
}

async function callGoogleRoutesRequest(body) {
  const res = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Routes API returned ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.routes || [];
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
    const allPoints = decodePolyline(route.polyline.encodedPolyline);
    const sampled = allPoints.length > 5 ? samplePoints(allPoints, 5) : allPoints;
    const { score, dangerousSegments } = scoreRoute(sampled);

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
    throw new Error('Google Routes could not find a route between these addresses.');
  }

  let scored = scoreRawRoutes(rawRoutes);

  const scoreRange = Math.max(...scored.map(r => r.safety_score))
                   - Math.min(...scored.map(r => r.safety_score));

  if (scored.length <= 1 || scoreRange < 0.05) {
    const altRaw = await generateAlternatives(origin, destination);
    const altScored = scoreRawRoutes(altRaw);
    const merged = deduplicateRoutes(altScored);
    if (merged.length > scored.length) {
      scored = merged;
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

  const { origin, destination } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'Both origin and destination are required.' });
  }

  try {
    const result = await computeRoutes(origin, destination);
    res.json(result);
  } catch (err) {
    console.error('[route] computeRoutes failed:', err.message);
    const msg = err.message || '';
    if (msg.includes('API key not configured')) {
      return res.status(503).json({ error: msg });
    }
    if (msg.includes('403') || msg.toLowerCase().includes('permission_denied')) {
      return res.status(503).json({ error: 'Google Routes API key is restricted. Verify Application Restrictions and API Restrictions in Google Cloud Console.' });
    }
    if (msg.includes('could not find a route') || msg.includes('No route found')) {
      return res.status(422).json({ error: 'No walking route found between those addresses. Try a more specific location.' });
    }
    if (msg.includes('400') || msg.toLowerCase().includes('invalid_argument')) {
      return res.status(422).json({ error: 'Could not parse one of the addresses. Try adding a city name (e.g. "Union Station, Toronto").' });
    }
    res.status(502).json({ error: `Route computation failed: ${msg}` });
  }
};
