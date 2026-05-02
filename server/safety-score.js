const Database = require('better-sqlite3');
const path = require('path');
const { estimateRisk } = require('./claude-score');

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

// User reports use a separate read connection to the same WAL db
const reportsDb = new Database(DB_PATH, { readonly: true });
reportsDb.pragma('journal_mode = WAL');

const nearbyUserReports = reportsDb.prepare(`
  SELECT lat, lng, category, created_at
  FROM user_reports
  WHERE lat BETWEEN ? AND ?
    AND lng BETWEEN ? AND ?
    AND created_at >= datetime('now', '-90 days')
`);

const severityWeights = {
  'Assault': 1.0,
  'Robbery': 1.0,
  'Sexual Violation': 1.0,
  'Break and Enter': 0.5,
  'Theft Over': 0.3,
  'Auto Theft': 0.2,
};

// Lower weights than police data — community reports are unverified
const reportSeverityWeights = {
  'harassment': 0.6,
  'suspicious_activity': 0.4,
  'poor_lighting': 0.25,
  'other': 0.2,
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

  if (hour >= 21 || hour < 5) return night;
  if (hour >= 7 && hour < 19) return day;

  if (hour >= 5 && hour < 7) {
    const t = (hour - 5) / 2;
    return {
      incident: night.incident + t * (day.incident - night.incident),
      lighting: night.lighting + t * (day.lighting - night.lighting),
    };
  }

  const t = (hour - 19) / 2;
  return {
    incident: day.incident + t * (night.incident - day.incident),
    lighting: day.lighting + t * (night.lighting - day.lighting),
  };
}

async function safetyCost(lat, lng, hour) {
  // Incident scoring — 500m bounding box
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

  // Community reports — 500m box, decay faster (90 day window already filtered in SQL)
  const reports = nearbyUserReports.all(
    lat - 0.0045, lat + 0.0045,
    lng - 0.006,  lng + 0.006
  );

  for (const rep of reports) {
    const meters = haversineMeters(lat, lng, rep.lat, rep.lng);
    const distanceWeight = 1 / (1 + meters / 100);
    const daysOld = rep.created_at
      ? (now - new Date(rep.created_at).getTime()) / (1000 * 60 * 60 * 24)
      : 45;
    // Reports decay 4× faster than police data (unverified, ephemeral)
    const recencyWeight = Math.exp(-daysOld / 90);
    const severity = reportSeverityWeights[rep.category] ?? 0.2;
    incidentSum += distanceWeight * recencyWeight * severity;
  }

  // When police data is sparse, use Claude to fill the gap.
  // Normalization: 25 weighted-equivalent incidents = max score, calibrated to Toronto's density.
  const dbIncidentScore = Math.min(incidentSum / 25, 1.0);

  let incidentScore;
  if (incidents.length < 3) {
    const aiEstimate = await estimateRisk(lat, lng, hour);
    if (aiEstimate !== null) {
      // Blend: weight DB data 30%, AI estimate 70% when data is sparse
      incidentScore = 0.3 * dbIncidentScore + 0.7 * aiEstimate;
    } else {
      incidentScore = dbIncidentScore;
    }
  } else {
    incidentScore = dbIncidentScore;
  }

  // Lighting scoring — 100m bounding box
  const { n: lightCount } = nearbyLightCount.get(
    lat - 0.0009, lat + 0.0009,
    lng - 0.0012, lng + 0.0012
  );
  // 15 streetlights in 100m radius = well-lit (calibrated to Toronto's dense streetlight grid)
  const lightingScore = Math.max(1 - lightCount / 15, 0);

  const weights = timeWeights(hour);
  const cost = incidentScore * weights.incident + lightingScore * weights.lighting;

  return Math.max(0, Math.min(1, cost));
}

async function scoreRoute(points, hour) {
  if (!points || points.length === 0) return { score: 0, dangerousSegments: 0 };
  const costs = await Promise.all(points.map(p => safetyCost(p.lat, p.lng, hour)));
  const score = costs.reduce((sum, c) => sum + c, 0) / costs.length;
  const dangerousSegments = costs.filter(c => c > 0.5).length;
  return { score, dangerousSegments };
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

  (async () => {
    for (const loc of testLocations) {
      const scoreNight = await safetyCost(loc.lat, loc.lng, 23);
      const scoreDay   = await safetyCost(loc.lat, loc.lng, 14);
      console.log(`${loc.name}`);
      console.log(`  11pm score: ${scoreNight.toFixed(3)}`);
      console.log(`   2pm score: ${scoreDay.toFixed(3)}`);
      console.log();
    }
  })();
}
