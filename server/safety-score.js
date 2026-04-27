const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');

const db = new Database(DB_PATH, { readonly: true });
db.pragma('journal_mode = WAL');

// Prepared once at module load — called hundreds of times per route score
const nearbyIncidents = db.prepare(`
  SELECT lat, lng, category, occurred_at
  FROM incidents
  WHERE lat BETWEEN ? AND ?
    AND lng BETWEEN ? AND ?
    AND lat IS NOT NULL AND lng IS NOT NULL
`);

const nearbyLightCount = db.prepare(`
  SELECT COUNT(*) as n
  FROM streetlights
  WHERE lat BETWEEN ? AND ?
    AND lng BETWEEN ? AND ?
`);

const severityWeights = {
  'Assault': 1.0,
  'Robbery': 1.0,
  'Sexual Violation': 1.0,
  'Break and Enter': 0.5,
  'Theft Over': 0.3,
  'Auto Theft': 0.2,
};

// Track unrecognized categories so we log each one only once
const unknownCategories = new Set();

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns incident and lighting weights for a given hour (0–23)
function timeWeights(hour) {
  const night = { incident: 0.6, lighting: 0.4 };
  const day   = { incident: 0.8, lighting: 0.1 };

  // Full night: 21:00–05:00
  if (hour >= 21 || hour < 5) return night;
  // Full day: 07:00–19:00
  if (hour >= 7 && hour < 19) return day;

  // Transition dawn: 05:00–07:00
  if (hour >= 5 && hour < 7) {
    const t = (hour - 5) / 2; // 0 at 5am, 1 at 7am
    return {
      incident: night.incident + t * (day.incident - night.incident),
      lighting: night.lighting + t * (day.lighting - night.lighting),
    };
  }

  // Transition dusk: 19:00–21:00
  const t = (hour - 19) / 2; // 0 at 7pm, 1 at 9pm
  return {
    incident: day.incident + t * (night.incident - day.incident),
    lighting: day.lighting + t * (night.lighting - day.lighting),
  };
}

function safetyCost(lat, lng, hour) {
  // Incident scoring — 500m bounding box (0.0045 lat ≈ 500m, 0.006 lng ≈ 500m at Toronto's latitude)
  const incidents = nearbyIncidents.all(
    lat - 0.0045, lat + 0.0045,
    lng - 0.006,  lng + 0.006
  );

  let incidentSum = 0;
  const now = Date.now();

  for (const inc of incidents) {
    const meters = haversineMeters(lat, lng, inc.lat, inc.lng);
    const distanceWeight = 1 / (1 + meters / 100);

    const daysOld = inc.occurred_at
      ? (now - new Date(inc.occurred_at).getTime()) / (1000 * 60 * 60 * 24)
      : 365;
    const recencyWeight = Math.exp(-daysOld / 365);

    let severity = severityWeights[inc.category];
    if (severity === undefined) {
      if (!unknownCategories.has(inc.category)) {
        console.warn(`Unknown incident category "${inc.category}" — using default weight 0.2`);
        unknownCategories.add(inc.category);
      }
      severity = 0.2;
    }

    incidentSum += distanceWeight * recencyWeight * severity;
  }

  // 5 weighted-equivalent incidents nearby = max score
  const incidentScore = Math.min(incidentSum / 5, 1.0);

  // Lighting scoring — 100m bounding box
  const { n: lightCount } = nearbyLightCount.get(
    lat - 0.0009, lat + 0.0009,
    lng - 0.0012, lng + 0.0012
  );
  const lightingScore = Math.max(1 - lightCount / 5, 0);

  const weights = timeWeights(hour);
  const cost = incidentScore * weights.incident + lightingScore * weights.lighting;

  return Math.max(0, Math.min(1, cost));
}

function scoreRoute(points, hour) {
  if (!points || points.length === 0) return 0;
  const total = points.reduce((sum, p) => sum + safetyCost(p.lat, p.lng, hour), 0);
  return total / points.length;
}

module.exports = { safetyCost, scoreRoute };

if (require.main === module) {
  const testLocations = [
    { name: 'Queen St E & Sherbourne (known rough area)', lat: 43.6520, lng: -79.3718 },
    { name: 'Yorkville Ave & Bay St (nice area, well-lit)',  lat: 43.6710, lng: -79.3934 },
  ];

  const dbCount = db.prepare('SELECT COUNT(*) as n FROM incidents').get();
  if (dbCount.n === 0) {
    console.error('No incidents in database. Run npm run sync first.');
    process.exit(1);
  }
  console.log(`Testing against ${dbCount.n} incidents in database.\n`);

  for (const loc of testLocations) {
    const scoreNight = safetyCost(loc.lat, loc.lng, 23);
    const scoreDay   = safetyCost(loc.lat, loc.lng, 14);
    console.log(`${loc.name}`);
    console.log(`  11pm score: ${scoreNight.toFixed(3)}`);
    console.log(`   2pm score: ${scoreDay.toFixed(3)}`);
    console.log();
  }
}
