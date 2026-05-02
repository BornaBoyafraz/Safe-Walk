const { scoreRoute } = require('./safety-score');

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

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
    throw new Error('Google Maps API key not configured. Add GOOGLE_MAPS_API_KEY to .env.');
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
      _sampled: sampled, // used for dedup, stripped before response
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

module.exports = { computeRoutes };
