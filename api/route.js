const Anthropic = require('@anthropic-ai/sdk');

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// ─── Claude client ────────────────────────────────────────────────────────────
let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const riskCache = new Map();

async function estimateRisk(lat, lng, hour) {
  if (!client) return 0.5;

  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${hour}`;
  if (riskCache.has(key)) return riskCache.get(key);

  const timeLabel =
    hour >= 21 || hour < 5  ? 'late night (high-risk hours)' :
    hour >= 5  && hour < 7  ? 'early morning' :
    hour >= 7  && hour < 19 ? 'daytime' : 'evening';

  try {
    const response = await Promise.race([
      client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8,
        messages: [{
          role: 'user',
          content: `You are a pedestrian safety scoring engine for Toronto, Canada.\n\nRate the pedestrian safety risk for this location:\n- Latitude: ${lat.toFixed(4)}, Longitude: ${lng.toFixed(4)}\n- Time: ${hour}:00 (${timeLabel})\n\nReturn ONLY a single decimal number between 0.00 and 1.00 where:\n  0.00 = very safe\n  1.00 = high risk\n\nBase your estimate on your knowledge of Toronto. Output the number only.`,
        }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);

    const raw = response.content[0]?.text?.trim();
    const score = parseFloat(raw);
    if (!isFinite(score) || score < 0 || score > 1) return 0.5;
    riskCache.set(key, score);
    return score;
  } catch {
    return 0.5;
  }
}

async function scoreRoute(points, hour) {
  if (!points || points.length === 0) return { score: 0, dangerousSegments: 0 };

  const step = Math.max(1, Math.floor(points.length / 6));
  const sampled = [];
  for (let i = 0; i < points.length; i += step) sampled.push(points[i]);

  const costs = await Promise.all(
    sampled.map(p => estimateRisk(p.lat, p.lng, hour))
  );

  const score = costs.reduce((sum, c) => sum + c, 0) / costs.length;
  const dangerousSegments = costs.filter(c => c > 0.5).length;
  return { score, dangerousSegments };
}

// ─── Google encoded polyline algorithm ────────────────────────────────────────
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
    const allPoints = decodePolyline(route.polyline.encodedPolyline);
    const sampled = allPoints.length > 5 ? samplePoints(allPoints, 5) : allPoints;
    const { score, dangerousSegments } = await scoreRoute(sampled, hour);

    return {
      polyline: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters,
      duration: route.duration,
      safety_score: parseFloat(score.toFixed(4)),
      dangerous_segments: dangerousSegments,
      google_rank: index,
      _sampled: sampled,
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
  const hour = new Date().getHours();
  let rawRoutes = await callGoogleRoutes(origin, destination);

  if (rawRoutes.length === 0) {
    throw new Error('Google Routes could not find a route between these addresses.');
  }

  let scored = await scoreRawRoutes(rawRoutes, hour);

  const scoreRange = Math.max(...scored.map(r => r.safety_score))
                   - Math.min(...scored.map(r => r.safety_score));

  if (scored.length <= 1 || scoreRange < 0.05) {
    const altRaw = await generateAlternatives(origin, destination);
    const altScored = await scoreRawRoutes(altRaw, hour);
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

// ─── Vercel handler ────────────────────────────────────────────────────────────
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
    if (err.message.includes('could not find a route')) {
      return res.status(422).json({ error: err.message });
    }
    if (err.message.includes('API key not configured')) {
      return res.status(503).json({ error: err.message });
    }
    res.status(502).json({ error: `Route computation failed: ${err.message}` });
  }
};
