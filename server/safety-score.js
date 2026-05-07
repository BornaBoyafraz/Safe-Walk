const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');

const db = new Database(DB_PATH, { readonly: true });
db.pragma('journal_mode = WAL');

const reportsDb = new Database(DB_PATH, { readonly: true });
reportsDb.pragma('journal_mode = WAL');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safePrepare(conn, sql) {
  try { return conn.prepare(sql); } catch { return null; }
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Time windows ─────────────────────────────────────────────────────────────

function timeWindow(hour) {
  if (hour >= 21 || hour < 5) return 'night';
  if (hour >= 7 && hour < 19) return 'day';
  if (hour >= 5 && hour < 7) return 'morning';
  return 'evening';
}

// Nighttime weights (9 PM – 5 AM): lighting matters most
const NIGHT_W = {
  incident: 0.30, lighting: 0.20, population: 0.10,
  transit: 0.08,  business: 0.08, roadClass: 0.07,
  callVolume: 0.10, userReport: 0.07,
};

// Daytime weights (7 AM – 7 PM): incident history dominates
const DAY_W = {
  incident: 0.35, lighting: 0.05, population: 0.12,
  transit: 0.10,  business: 0.05, roadClass: 0.10,
  callVolume: 0.15, userReport: 0.08,
};

function lerp(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) out[k] = a[k] + t * (b[k] - a[k]);
  return out;
}

function timeWeights(hour) {
  if (hour >= 21 || hour < 5) return NIGHT_W;
  if (hour >= 7 && hour < 19) return DAY_W;
  if (hour >= 5 && hour < 7) return lerp(NIGHT_W, DAY_W, (hour - 5) / 2);
  return lerp(DAY_W, NIGHT_W, (hour - 19) / 2);
}

// ─── Prepared statements ──────────────────────────────────────────────────────

// 2-year window keeps the dataset manageable and makes scores reflect current conditions
const nearbyIncidents = db.prepare(`
  SELECT lat, lng, category, occurred_at
  FROM incidents
  WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
    AND lat IS NOT NULL AND lng IS NOT NULL
    AND occurred_at >= datetime('now', '-2 years')
`);

// Return wattage so we can apply brightness weighting
const nearbyLights = db.prepare(`
  SELECT wattage FROM streetlights
  WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
`);

const nearbyUserReports = reportsDb.prepare(`
  SELECT lat, lng, category, created_at
  FROM user_reports
  WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
    AND created_at >= datetime('now', '-90 days')
`);

const nearbyTransitStops = safePrepare(db, `
  SELECT lat, lng FROM transit_stops
  WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
`);

// Whether each optional table has any rows — if empty, return neutral score
let hasTransitData = false;
try {
  hasTransitData = db.prepare('SELECT COUNT(*) as n FROM transit_stops').get().n > 0;
} catch {}


const nearestCensus = safePrepare(db, `
  SELECT density FROM census_density
  WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
  LIMIT 1
`);

const nearestRoad = safePrepare(db, `
  SELECT highway FROM road_segments
  WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
  LIMIT 1
`);

const nearbyServiceCalls = safePrepare(db, `
  SELECT category, occurred_at FROM service_calls
  WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
    AND occurred_at >= datetime('now', '-2 years')
`);

// ─── Severity weights ─────────────────────────────────────────────────────────

const incidentSeverity = {
  'Assault': 1.0, 'Sexual Violation': 1.0, 'Robbery': 1.0,
  'Break and Enter': 0.5, 'Theft Over': 0.3, 'Auto Theft': 0.2,
};

const reportSeverity = {
  'harassment': 0.6, 'suspicious_activity': 0.4,
  'poor_lighting': 0.25, 'other': 0.2,
};

const callSeverity = {
  'Assault': 1.0, 'Violence': 1.0, 'Shooting': 1.0,
  'Suspicious': 0.7, 'Encampment': 0.4,
  'Noise': 0.1, 'Graffiti': 0.05,
};

const roadClassScore = {
  'motorway': 0.2, 'trunk': 0.2,
  'primary': 0.2, 'secondary': 0.25,
  'tertiary': 0.3, 'residential': 0.5,
  'service': 0.7, 'alley': 0.8,
  'path': 0.6, 'footway': 0.6, 'track': 0.7,
};

const unknownCategories = new Set();

// ─── Signal scorers ───────────────────────────────────────────────────────────

function incidentSignal(lat, lng, hour) {
  const incidents = nearbyIncidents.all(
    lat - 0.0045, lat + 0.0045,
    lng - 0.006,  lng + 0.006
  );

  if (incidents.length === 0) return 0;

  const now = Date.now();
  const currentWindow = timeWindow(hour);

  // Build hotspot grid: ~50m cells, count recent incidents per cell
  const hotspotCells = new Map();
  for (const inc of incidents) {
    const daysOld = inc.occurred_at
      ? (now - new Date(inc.occurred_at).getTime()) / 86400000
      : 365;
    if (daysOld <= 365) {
      const key = `${Math.round(inc.lat / 0.00045)},${Math.round(inc.lng / 0.00060)}`;
      hotspotCells.set(key, (hotspotCells.get(key) || 0) + 1);
    }
  }

  let sum = 0;
  for (const inc of incidents) {
    const meters = haversineMeters(lat, lng, inc.lat, inc.lng);
    const distanceWeight = 1 / (1 + meters / 100);

    const daysOld = inc.occurred_at
      ? (now - new Date(inc.occurred_at).getTime()) / 86400000
      : 365;
    const recencyWeight = Math.exp(-daysOld / 365);

    let severity = incidentSeverity[inc.category];
    if (severity === undefined) {
      if (!unknownCategories.has(inc.category)) {
        console.warn(`Unknown incident category "${inc.category}" — using 0.2`);
        unknownCategories.add(inc.category);
      }
      severity = 0.2;
    }

    // 1.3x multiplier when incident time window matches current routing time
    const incWindow = inc.occurred_at ? timeWindow(new Date(inc.occurred_at).getHours()) : null;
    const timeMatch = incWindow === currentWindow ? 1.3 : 1.0;

    // 1.5x multiplier when point is inside a known hotspot (3+ incidents in 50m in last year)
    const cellKey = `${Math.round(inc.lat / 0.00045)},${Math.round(inc.lng / 0.00060)}`;
    const hotspot = (hotspotCells.get(cellKey) || 0) >= 3 ? 1.5 : 1.0;

    sum += distanceWeight * recencyWeight * severity * timeMatch * hotspot;
  }

  // 150 = calibrated so Queen/Sherbourne (dense crime) scores ~0.85-0.9,
  // leaving headroom to differentiate moderate and low-crime areas below it
  return Math.min(sum / 150, 1.0);
}

function lightingSignal(lat, lng) {
  const lights = nearbyLights.all(
    lat - 0.0009, lat + 0.0009,
    lng - 0.0012, lng + 0.0012
  );

  if (lights.length === 0) return 1.0;  // no lights = maximum dark risk

  // Weight each light by sqrt(wattage / 150). Null/unknown wattage = 150W default.
  let weightedCount = 0;
  for (const light of lights) {
    const w = (light.wattage && light.wattage > 0) ? light.wattage : 150;
    weightedCount += Math.sqrt(w / 150);
  }

  // 15 wattage-weighted lights within 100m = fully lit
  return Math.max(1 - weightedCount / 15, 0);
}

function userReportSignal(lat, lng) {
  const reports = nearbyUserReports.all(
    lat - 0.0045, lat + 0.0045,
    lng - 0.006,  lng + 0.006
  );

  if (reports.length === 0) return 0;

  const now = Date.now();
  let sum = 0;

  for (const rep of reports) {
    const meters = haversineMeters(lat, lng, rep.lat, rep.lng);
    const distanceWeight = 1 / (1 + meters / 100);
    const daysOld = rep.created_at
      ? (now - new Date(rep.created_at).getTime()) / 86400000
      : 45;
    const recencyWeight = Math.exp(-daysOld / 90);
    const severity = reportSeverity[rep.category] ?? 0.2;
    sum += distanceWeight * recencyWeight * severity;
  }

  return Math.min(sum / 10, 1.0);
}

function transitSignal(lat, lng) {
  if (!nearbyTransitStops || !hasTransitData) return 0.5;

  const stops = nearbyTransitStops.all(
    lat - 0.009, lat + 0.009,
    lng - 0.012, lng + 0.012
  );

  if (stops.length === 0) return 1.0;  // no nearby stop = max transit-absence risk

  let minDist = Infinity;
  for (const s of stops) {
    const d = haversineMeters(lat, lng, s.lat, s.lng);
    if (d < minDist) minDist = d;
  }

  // Within 500m of a stop = 0 danger; farther = linearly more risky
  return Math.min(minDist / 500, 1.0);
}

function populationSignal(lat, lng) {
  if (!nearestCensus) return 0.5;

  const row = nearestCensus.get(
    lat - 0.045, lat + 0.045,
    lng - 0.060, lng + 0.060
  );

  if (!row || row.density === null) return 0.5;

  // 10,000 people/km² = very safe (dense urban). 0 = empty and risky.
  return Math.max(1 - row.density / 10000, 0);
}

function roadClassSignal(lat, lng) {
  if (!nearestRoad) return 0.5;

  const row = nearestRoad.get(
    lat - 0.0009, lat + 0.0009,
    lng - 0.0012, lng + 0.0012
  );

  if (!row || !row.highway) return 0.5;

  return roadClassScore[row.highway] ?? 0.5;
}

function serviceCallSignal(lat, lng) {
  if (!nearbyServiceCalls) return 0;

  const calls = nearbyServiceCalls.all(
    lat - 0.0045, lat + 0.0045,
    lng - 0.006,  lng + 0.006
  );

  if (calls.length === 0) return 0;

  const now = Date.now();
  let sum = 0;

  for (const call of calls) {
    const daysOld = call.occurred_at
      ? (now - new Date(call.occurred_at).getTime()) / 86400000
      : 365;
    const recencyWeight = Math.exp(-daysOld / 365);

    let severity = 0.1;
    for (const [key, val] of Object.entries(callSeverity)) {
      if (call.category && call.category.includes(key)) { severity = val; break; }
    }

    sum += recencyWeight * severity;
  }

  // 10 weighted calls = max score
  return Math.min(sum / 10, 1.0);
}

// ─── Main cost function ───────────────────────────────────────────────────────

function safetyCost(lat, lng, hour) {
  const w = timeWeights(hour);

  const scores = {
    incident:   incidentSignal(lat, lng, hour),
    lighting:   lightingSignal(lat, lng),
    population: populationSignal(lat, lng),
    transit:    transitSignal(lat, lng),
    business:   0.5,   // future: OSM POI layer
    roadClass:  roadClassSignal(lat, lng),
    callVolume: serviceCallSignal(lat, lng),
    userReport: userReportSignal(lat, lng),
  };

  const cost =
    w.incident   * scores.incident   +
    w.lighting   * scores.lighting   +
    w.population * scores.population +
    w.transit    * scores.transit    +
    w.business   * scores.business   +
    w.roadClass  * scores.roadClass  +
    w.callVolume * scores.callVolume +
    w.userReport * scores.userReport;

  return Math.max(0, Math.min(1, cost));
}

function scoreRoute(points, hour) {
  if (!points || points.length === 0) return { score: 0, dangerousSegments: 0 };
  const costs = points.map(p => safetyCost(p.lat, p.lng, hour));
  const score = costs.reduce((sum, c) => sum + c, 0) / costs.length;
  const dangerousSegments = costs.filter(c => c > 0.5).length;
  return { score, dangerousSegments };
}

module.exports = { safetyCost, scoreRoute };

// ─── CLI test ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const testLocations = [
    { name: 'Queen St E & Sherbourne (known rough area)', lat: 43.6520, lng: -79.3718 },
    { name: 'Yorkville Ave & Bay St (nice area, well-lit)',  lat: 43.6710, lng: -79.3934 },
    { name: 'Financial District, King & Bay',               lat: 43.6481, lng: -79.3813 },
    { name: 'Jane & Finch (higher-risk suburb)',             lat: 43.7580, lng: -79.5101 },
  ];

  const dbCount = db.prepare('SELECT COUNT(*) as n FROM incidents').get();
  if (dbCount.n === 0) {
    console.error('No incidents in database. Run npm run sync first.');
    process.exit(1);
  }
  console.log(`Testing against ${dbCount.n} incidents in database.\n`);

  const transitCount = db.prepare('SELECT COUNT(*) as n FROM transit_stops').get();
  const censusCount  = db.prepare('SELECT COUNT(*) as n FROM census_density').get();
  const roadCount    = db.prepare('SELECT COUNT(*) as n FROM road_segments').get();
  const callCount    = db.prepare('SELECT COUNT(*) as n FROM service_calls').get();
  console.log(`Layers: ${transitCount.n} transit stops, ${censusCount.n} census DAs, ${roadCount.n} road segments, ${callCount.n} service calls\n`);

  for (const loc of testLocations) {
    const scoreNight = safetyCost(loc.lat, loc.lng, 23);
    const scoreDay   = safetyCost(loc.lat, loc.lng, 14);
    console.log(`${loc.name}`);
    console.log(`  11 PM: ${scoreNight.toFixed(3)}`);
    console.log(`   2 PM: ${scoreDay.toFixed(3)}`);
    console.log();
  }
}
