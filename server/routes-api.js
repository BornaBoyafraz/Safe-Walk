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
  // Always include the last point
  if (points.length > 0 && sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }
  return sampled;
}

async function callGoogleRoutes(origin, destination) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || apiKey === 'placeholder_add_key_later') {
    throw new Error('Google Maps API key not configured. Add GOOGLE_MAPS_API_KEY to .env.');
  }

  const res = await fetch(ROUTES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      travelMode: 'WALK',
      computeAlternativeRoutes: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Routes API returned ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.routes || [];
}

async function computeRoutes(origin, destination) {
  const hour = new Date().getHours();
  const rawRoutes = await callGoogleRoutes(origin, destination);

  if (rawRoutes.length === 0) {
    throw new Error('Google Routes could not find a route between these addresses.');
  }

  const scored = rawRoutes.map((route, index) => {
    const allPoints = decodePolyline(route.polyline.encodedPolyline);
    // Sample every 5th point for performance; always include endpoints
    const sampled = allPoints.length > 5 ? samplePoints(allPoints, 5) : allPoints;
    const safetyScore = scoreRoute(sampled, hour);

    return {
      polyline: route.polyline.encodedPolyline,
      distanceMeters: route.distanceMeters,
      duration: route.duration,
      safety_score: parseFloat(safetyScore.toFixed(4)),
      google_rank: index, // 0 = Google's default (fastest) route
    };
  });

  // Sort ascending by safety score — lowest = safest
  const bySafety = [...scored].sort((a, b) => a.safety_score - b.safety_score);

  return {
    fastest: scored[0],   // Google's first route is always the fastest
    safest: bySafety[0],  // Lowest safety cost = safest
    all_routes: bySafety,
  };
}

module.exports = { computeRoutes };
