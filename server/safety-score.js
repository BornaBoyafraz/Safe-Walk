const fs = require('fs');
const path = require('path');

let Database = null;
try {
  Database = require('better-sqlite3');
} catch (err) {
  console.warn('[score] better-sqlite3 unavailable; route scoring will use heatmap fallback only.', {
    message: err.message,
  });
}

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');
const HEATMAP_PATH = path.join(__dirname, '..', 'public', 'data', 'heatmap.json');
const TORONTO_TIME_ZONE = 'America/Toronto';

const SAMPLE_SPACING_METERS = 75;
const INCIDENT_RADIUS_METERS = 300;
const STREETLIGHT_RADIUS_METERS = 110;
const REPORT_RADIUS_METERS = 300;
const INCIDENT_LOOKBACK_YEARS = 3;
const REPORT_LOOKBACK_DAYS = 365;

const CRIME_DENSITY_SCALE = 115;
const COMMUNITY_DENSITY_SCALE = 1.6;
const IDEAL_LIGHTS_PER_100M = 2.2;

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function round4(value) {
  return Number(clamp(value).toFixed(4));
}

function logScore(event, meta = {}) {
  console.log(`[score] ${event}`, meta);
}

function logScoreError(event, meta = {}) {
  console.error(`[score] ${event}`, meta);
}

function openDatabase() {
  if (!Database || !fs.existsSync(DB_PATH)) return null;

  try {
    return new Database(DB_PATH, { readonly: true, fileMustExist: true });
  } catch (err) {
    logScoreError('database open failed; route scoring will use heatmap fallback only', {
      message: err.message,
    });
    return null;
  }
}

function safePrepare(conn, sql) {
  if (!conn) return null;
  try {
    return conn.prepare(sql);
  } catch (err) {
    logScoreError('scoring statement prepare failed', { message: err.message });
    return null;
  }
}

const db = openDatabase();

const statements = {
  incidents: safePrepare(db, `
    SELECT lat, lng, category, offence, occurred_at
    FROM incidents
    WHERE lat BETWEEN @minLat AND @maxLat
      AND lng BETWEEN @minLng AND @maxLng
      AND lat IS NOT NULL AND lng IS NOT NULL
      AND lat != 0 AND lng != 0
      AND (occurred_at IS NULL OR occurred_at >= @incidentCutoff)
  `),
  streetlights: safePrepare(db, `
    SELECT lat, lng, wattage, status
    FROM streetlights
    WHERE lat BETWEEN @minLat AND @maxLat
      AND lng BETWEEN @minLng AND @maxLng
      AND lat IS NOT NULL AND lng IS NOT NULL
      AND lat != 0 AND lng != 0
      AND LOWER(COALESCE(status, 'active')) NOT LIKE '%inactive%'
  `),
  reports: safePrepare(db, `
    SELECT lat, lng, category, created_at, verified
    FROM user_reports
    WHERE lat BETWEEN @minLat AND @maxLat
      AND lng BETWEEN @minLng AND @maxLng
      AND lat IS NOT NULL AND lng IS NOT NULL
      AND lat != 0 AND lng != 0
      AND (created_at IS NULL OR created_at >= @reportCutoff)
  `),
};

let heatmapPoints = null;

function loadHeatmapPoints() {
  if (heatmapPoints !== null) return heatmapPoints;

  try {
    const raw = fs.readFileSync(HEATMAP_PATH, 'utf8');
    heatmapPoints = JSON.parse(raw);
    logScore('loaded heatmap fallback incidents', { count: heatmapPoints.length });
  } catch (err) {
    heatmapPoints = [];
    logScoreError('heatmap fallback unavailable', { message: err.message });
  }

  return heatmapPoints;
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

function metersToLatDegrees(meters) {
  return meters / 111320;
}

function metersToLngDegrees(meters, lat) {
  const metersPerDegree = 111320 * Math.max(Math.cos(lat * Math.PI / 180), 0.25);
  return meters / metersPerDegree;
}

function routeLengthMeters(points) {
  let meters = 0;
  for (let i = 1; i < points.length; i++) {
    meters += haversineMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return meters;
}

function interpolatePoint(a, b, t, distanceAlong) {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    distanceAlong,
  };
}

function sampleRouteByDistance(points, spacingMeters = SAMPLE_SPACING_METERS) {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0], distanceAlong: 0 }];

  const sampled = [{ ...points[0], distanceAlong: 0 }];
  let totalDistance = 0;
  let distanceSinceSample = 0;

  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1];
    const end = points[i];
    const segmentLength = haversineMeters(start.lat, start.lng, end.lat, end.lng);
    if (!Number.isFinite(segmentLength) || segmentLength <= 0) continue;

    let consumed = 0;
    while (distanceSinceSample + (segmentLength - consumed) >= spacingMeters) {
      const needed = spacingMeters - distanceSinceSample;
      consumed += needed;
      sampled.push(interpolatePoint(start, end, consumed / segmentLength, totalDistance + consumed));
      distanceSinceSample = 0;
    }

    distanceSinceSample += segmentLength - consumed;
    totalDistance += segmentLength;
  }

  const last = points[points.length - 1];
  const lastSample = sampled[sampled.length - 1];
  if (!lastSample || haversineMeters(lastSample.lat, lastSample.lng, last.lat, last.lng) > 3) {
    sampled.push({ ...last, distanceAlong: totalDistance });
  }

  return sampled;
}

function routeBounds(points, paddingMeters) {
  const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length === 0) {
    return {
      minLat: 0, maxLat: 0, minLng: 0, maxLng: 0, referenceLat: 43.6532,
    };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let latSum = 0;

  for (const point of valid) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
    latSum += point.lat;
  }

  const referenceLat = latSum / valid.length;
  const latPad = metersToLatDegrees(paddingMeters);
  const lngPad = metersToLngDegrees(paddingMeters, referenceLat);

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
    referenceLat,
  };
}

function dateDaysAgo(days, now = new Date()) {
  return new Date(now.getTime() - days * 86400000);
}

function dateYearsAgo(years, now = new Date()) {
  const out = new Date(now.getTime());
  out.setFullYear(out.getFullYear() - years);
  return out;
}

function daysSince(value, nowMs) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, (nowMs - parsed) / 86400000);
}

function getTorontoHour(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TORONTO_TIME_ZONE,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date);
    const raw = Number(parts.find(part => part.type === 'hour')?.value);
    if (Number.isFinite(raw)) return raw === 24 ? 0 : raw;
  } catch {}

  return date.getHours();
}

function timeWindow(hour) {
  if (hour >= 22 || hour < 5) return 'night';
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'day';
}

function timeProfile(hour) {
  const window = timeWindow(hour);
  const profiles = {
    day: {
      label: 'day',
      weights: { crime: 0.68, lighting: 0.08, community: 0.24 },
      timeOfDayMultiplier: 1.0,
      personalCrimeBoost: 1.0,
      lightingBoost: 0.35,
      reportBoost: 0.9,
      recentIncidentBoost: 1.0,
    },
    evening: {
      label: 'evening',
      weights: { crime: 0.62, lighting: 0.22, community: 0.16 },
      timeOfDayMultiplier: 1.08,
      personalCrimeBoost: 1.12,
      lightingBoost: 1.0,
      reportBoost: 1.05,
      recentIncidentBoost: 1.08,
    },
    night: {
      label: 'night',
      weights: { crime: 0.62, lighting: 0.24, community: 0.14 },
      timeOfDayMultiplier: 1.18,
      personalCrimeBoost: 1.28,
      lightingBoost: 1.25,
      reportBoost: 1.2,
      recentIncidentBoost: 1.18,
    },
    dawn: {
      label: 'dawn',
      weights: { crime: 0.62, lighting: 0.20, community: 0.18 },
      timeOfDayMultiplier: 1.1,
      personalCrimeBoost: 1.15,
      lightingBoost: 0.9,
      reportBoost: 1.1,
      recentIncidentBoost: 1.1,
    },
  };

  return profiles[window];
}

function incidentCategory(row) {
  const text = `${row.category || ''} ${row.offence || ''}`.toLowerCase();

  if (/assault/.test(text)) {
    return { label: 'Assault', severity: 1.0, personal: true };
  }
  if (/robbery|mugging/.test(text)) {
    return { label: 'Robbery', severity: 0.9, personal: true };
  }
  if (/sexual|shooting|firearm|weapon|homicide/.test(text)) {
    return { label: row.category || 'Violent crime', severity: 0.88, personal: true };
  }
  if (/break|enter|b&e/.test(text)) {
    return { label: 'Break and Enter', severity: 0.5, personal: false };
  }
  if (/theft over/.test(text)) {
    return { label: 'Theft Over', severity: 0.3, personal: false };
  }
  if (/auto theft|motor vehicle|vehicle theft/.test(text)) {
    return { label: 'Auto Theft', severity: 0.22, personal: false };
  }

  if (Number.isFinite(row.fallbackWeight)) {
    return {
      label: 'Historical incident',
      severity: clamp(row.fallbackWeight / 3.1, 0.18, 1),
      personal: row.fallbackWeight >= 1.9,
    };
  }

  return { label: row.category || 'Other incident', severity: 0.18, personal: false };
}

function incidentRecencyWeight(daysOld) {
  if (daysOld === null) return 0.35;
  if (daysOld <= 30) return 1.0;
  if (daysOld <= 90) return 0.82;
  if (daysOld <= 180) return 0.58;
  if (daysOld <= 365) return 0.34;
  return Math.max(0.04, 0.10 * Math.exp(-(daysOld - 365) / 545));
}

function incidentDistanceWeight(meters) {
  if (meters > INCIDENT_RADIUS_METERS) return 0;
  if (meters <= 50) return 1;
  if (meters <= 150) return 1 - ((meters - 50) / 100) * 0.55;
  return 0.45 - ((meters - 150) / 150) * 0.37;
}

function lightDistanceWeight(meters) {
  if (meters > STREETLIGHT_RADIUS_METERS) return 0;
  if (meters <= 30) return 1;
  if (meters <= 75) return 0.75 - ((meters - 30) / 45) * 0.30;
  return 0.35 - ((meters - 75) / 35) * 0.23;
}

function reportDistanceWeight(meters) {
  if (meters > REPORT_RADIUS_METERS) return 0;
  if (meters <= 50) return 1;
  if (meters <= 150) return 0.75 - ((meters - 50) / 100) * 0.35;
  return 0.35 - ((meters - 150) / 150) * 0.27;
}

function reportSeverity(category = '') {
  const text = category.toLowerCase();
  if (/harass|threat|intimidat|aggressive/.test(text)) return { label: 'harassment', severity: 0.8 };
  if (/poor_lighting|poor lighting|lighting|dark/.test(text)) return { label: 'poor lighting', severity: 0.5 };
  if (/suspicious/.test(text)) return { label: 'suspicious activity', severity: 0.48 };
  return { label: category || 'general concern', severity: 0.22 };
}

function reportRecencyWeight(daysOld) {
  if (daysOld === null) return 0.5;
  if (daysOld <= 30) return 1.0;
  if (daysOld <= 90) return 0.72;
  if (daysOld <= 180) return 0.42;
  return 0.16;
}

function buildSampleGrid(samples, referenceLat, cellMeters = 150) {
  const originLat = Math.min(...samples.map(p => p.lat));
  const originLng = Math.min(...samples.map(p => p.lng));
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.max(Math.cos(referenceLat * Math.PI / 180), 0.25);
  const cells = new Map();

  function xy(lat, lng) {
    return {
      x: (lng - originLng) * metersPerLng,
      y: (lat - originLat) * metersPerLat,
    };
  }

  function cellFor(lat, lng) {
    const point = xy(lat, lng);
    return {
      cx: Math.floor(point.x / cellMeters),
      cy: Math.floor(point.y / cellMeters),
      ...point,
    };
  }

  samples.forEach((sample, index) => {
    const cell = cellFor(sample.lat, sample.lng);
    const key = `${cell.cx},${cell.cy}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push({ ...sample, index, x: cell.x, y: cell.y });
  });

  function nearest(lat, lng, maxMeters) {
    const cell = cellFor(lat, lng);
    const radius = Math.ceil(maxMeters / cellMeters) + 1;
    let best = null;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const nearby = cells.get(`${cell.cx + dx},${cell.cy + dy}`);
        if (!nearby) continue;

        for (const sample of nearby) {
          const meters = Math.hypot(sample.x - cell.x, sample.y - cell.y);
          if (!best || meters < best.distanceMeters) {
            best = { index: sample.index, distanceMeters: meters };
          }
        }
      }
    }

    if (!best || best.distanceMeters > maxMeters) return null;
    return best;
  }

  return { nearest };
}

function queryScoringRows(bounds, now) {
  const params = {
    minLat: bounds.minLat,
    maxLat: bounds.maxLat,
    minLng: bounds.minLng,
    maxLng: bounds.maxLng,
    incidentCutoff: dateYearsAgo(INCIDENT_LOOKBACK_YEARS, now).toISOString(),
    reportCutoff: dateDaysAgo(REPORT_LOOKBACK_DAYS, now).toISOString(),
  };

  let incidents = [];
  let incidentSource = 'none';

  if (statements.incidents) {
    incidents = statements.incidents.all(params);
    incidentSource = 'sqlite';
  } else {
    incidents = loadHeatmapPoints()
      .filter(point =>
        point.lat >= bounds.minLat &&
        point.lat <= bounds.maxLat &&
        point.lng >= bounds.minLng &&
        point.lng <= bounds.maxLng
      )
      .map(point => ({
        lat: point.lat,
        lng: point.lng,
        category: 'Historical incident',
        offence: null,
        occurred_at: null,
        fallbackWeight: point.weight,
      }));
    incidentSource = incidents.length > 0 ? 'heatmap' : 'none';
  }

  return {
    incidents,
    incidentSource,
    streetlights: statements.streetlights ? statements.streetlights.all(params) : [],
    reports: statements.reports ? statements.reports.all(params) : [],
  };
}

function scoreIncidents({ incidents, grid, routeKm, sampleCount, profile, nowMs }) {
  const sampleLoads = Array(sampleCount).fill(0);
  const categories = new Map();
  let totalWeight = 0;
  let closePersonalWeight = 0;

  for (const incident of incidents) {
    const nearest = grid.nearest(incident.lat, incident.lng, INCIDENT_RADIUS_METERS);
    if (!nearest) continue;

    const category = incidentCategory(incident);
    const daysOld = daysSince(incident.occurred_at, nowMs);
    let recency = incidentRecencyWeight(daysOld);
    if (daysOld !== null && daysOld <= 180) recency *= profile.recentIncidentBoost;

    const distanceWeight = incidentDistanceWeight(nearest.distanceMeters);
    const personalBoost = category.personal ? profile.personalCrimeBoost : 1;
    const contribution = category.severity * recency * distanceWeight * personalBoost;

    if (contribution <= 0) continue;

    totalWeight += contribution;
    sampleLoads[nearest.index] += contribution;

    const current = categories.get(category.label) || { weight: 0, closeWeight: 0 };
    current.weight += contribution;
    if (nearest.distanceMeters <= 150) current.closeWeight += contribution;
    categories.set(category.label, current);

    if (category.personal && nearest.distanceMeters <= 150) {
      closePersonalWeight += contribution;
    }
  }

  const weightedPerKm = totalWeight / Math.max(routeKm, 0.25);
  const crimeRisk = clamp(1 - Math.exp(-weightedPerKm / CRIME_DENSITY_SCALE));

  return {
    crimeRisk,
    weightedPerKm,
    sampleLoads,
    categories,
    closePersonalWeight,
  };
}

function scoreStreetlights({ streetlights, grid, routeMeters, sampleCount, profile }) {
  const sampleCoverage = Array(sampleCount).fill(0);
  let weightedLights = 0;

  for (const light of streetlights) {
    const nearest = grid.nearest(light.lat, light.lng, STREETLIGHT_RADIUS_METERS);
    if (!nearest) continue;

    const distanceWeight = lightDistanceWeight(nearest.distanceMeters);
    const watts = light.wattage && light.wattage > 0 ? light.wattage : 150;
    const brightness = clamp(Math.sqrt(watts / 150), 0.55, 1.4);
    const contribution = distanceWeight * brightness;

    weightedLights += contribution;
    sampleCoverage[nearest.index] += contribution;
  }

  const lightsPer100m = weightedLights / Math.max(routeMeters / 100, 1);
  const coverage = clamp(lightsPer100m / IDEAL_LIGHTS_PER_100M);
  const rawLightingRisk = 1 - coverage;
  const lightingRisk = clamp(rawLightingRisk * profile.lightingBoost);

  return {
    lightingRisk,
    rawLightingRisk,
    lightsPer100m,
    sampleCoverage,
  };
}

function scoreReports({ reports, grid, routeKm, sampleCount, profile, nowMs }) {
  const sampleLoads = Array(sampleCount).fill(0);
  const cellTotals = new Map();
  const typeWeights = new Map();

  for (const report of reports) {
    const nearest = grid.nearest(report.lat, report.lng, REPORT_RADIUS_METERS);
    if (!nearest) continue;

    const severity = reportSeverity(report.category);
    const recency = reportRecencyWeight(daysSince(report.created_at, nowMs));
    const distanceWeight = reportDistanceWeight(nearest.distanceMeters);
    const verificationBoost = Number(report.verified) === 1 ? 1.25 : 1;
    const contribution = severity.severity * recency * distanceWeight * verificationBoost * profile.reportBoost;
    if (contribution <= 0) continue;

    const cellKey = `${nearest.index}:${severity.label}`;
    cellTotals.set(cellKey, Math.min((cellTotals.get(cellKey) || 0) + contribution, 1.6));
    typeWeights.set(severity.label, (typeWeights.get(severity.label) || 0) + contribution);
    sampleLoads[nearest.index] += Math.min(contribution, 0.8);
  }

  let cappedTotal = 0;
  for (const value of cellTotals.values()) cappedTotal += value;

  const weightedPerKm = cappedTotal / Math.max(routeKm, 0.25);
  const communityRisk = clamp(1 - Math.exp(-weightedPerKm / COMMUNITY_DENSITY_SCALE));

  return {
    communityRisk,
    weightedPerKm,
    sampleLoads,
    typeWeights,
  };
}

function computeDangerousSegments({ sampleCount, crime, lighting, community, profile }) {
  let dangerous = 0;

  for (let i = 0; i < sampleCount; i++) {
    const pointCrime = clamp(1 - Math.exp(-crime.sampleLoads[i] / 1.6));
    const pointLight = clamp((1 - clamp(lighting.sampleCoverage[i] / 1.4)) * profile.lightingBoost);
    const pointCommunity = clamp(1 - Math.exp(-community.sampleLoads[i] / 0.9));
    const pointRisk =
      profile.weights.crime * pointCrime +
      profile.weights.lighting * pointLight +
      profile.weights.community * pointCommunity;

    if (pointRisk * profile.timeOfDayMultiplier > 0.55) dangerous++;
  }

  return dangerous;
}

function confidenceLabel(score) {
  if (score >= 0.72) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

function computeConfidence({ incidentSource, incidentCount, streetlightCount, reportCount, sampleCount, routeMeters }) {
  let score = 0.18;

  if (incidentSource === 'sqlite') score += 0.28;
  else if (incidentSource === 'heatmap') score += 0.16;

  if (incidentCount >= 60) score += 0.18;
  else if (incidentCount > 0) score += 0.10;

  if (streetlightCount >= 20) score += 0.18;
  else if (streetlightCount > 0) score += 0.10;
  else if (statements.streetlights) score += 0.04;

  if (reportCount >= 3) score += 0.08;
  else if (reportCount > 0) score += 0.04;
  else if (statements.reports) score += 0.02;

  const expectedSamples = Math.max(2, Math.ceil(routeMeters / SAMPLE_SPACING_METERS));
  if (sampleCount >= expectedSamples) score += 0.10;

  return round4(score);
}

function topEntry(map) {
  let best = null;
  for (const [label, value] of map.entries()) {
    const weight = typeof value === 'number' ? value : value.weight;
    if (!best || weight > best.weight) best = { label, weight, value };
  }
  return best;
}

function makeExplanation({ crime, lighting, community, profile, confidence }) {
  const factors = [];
  const topCrime = topEntry(crime.categories);
  const topReport = topEntry(community.typeWeights);

  if (crime.crimeRisk >= 0.55 && topCrime) {
    const close = topCrime.value.closeWeight >= topCrime.value.weight * 0.35;
    factors.push(close
      ? `Higher ${topCrime.label.toLowerCase()} density within 150m`
      : `Elevated ${topCrime.label.toLowerCase()} density within 300m`);
  } else if (crime.crimeRisk >= 0.32 && topCrime) {
    factors.push(`Moderate recent ${topCrime.label.toLowerCase()} history near the route`);
  }

  if (lighting.lightingRisk >= 0.45 && (profile.label === 'night' || profile.label === 'evening' || profile.label === 'dawn')) {
    factors.push('Lower streetlight coverage after sunset');
  } else if (lighting.rawLightingRisk >= 0.65) {
    factors.push('Sparse streetlight coverage near the route');
  }

  if (community.communityRisk >= 0.22 && topReport) {
    factors.push(`Recent ${topReport.label} reports nearby`);
  }

  if (profile.label === 'night' && (crime.closePersonalWeight > 0 || lighting.lightingRisk > 0.35)) {
    factors.push('Nighttime weighting increases personal safety risk');
  }

  if (factors.length === 0) {
    factors.push('Lower nearby incident density on the sampled route');
  }

  return {
    mainFactors: factors.slice(0, 3),
    confidence: confidenceLabel(confidence),
  };
}

function normalizeFinalRisk(baseRisk, multiplier) {
  return clamp(1 - Math.exp(-(baseRisk * multiplier) * 1.18));
}

function normalizeScoreRouteOptions(options) {
  if (typeof options === 'number') return { hour: options };
  return options || {};
}

function neutralScore(reason = 'Scoring data unavailable.') {
  return {
    score: 0.5,
    dangerousSegments: 0,
    crimeRisk: 0,
    lightingRisk: 0.5,
    communityRisk: 0,
    timeOfDayMultiplier: 1,
    confidenceScore: 0.2,
    explanation: {
      mainFactors: [reason],
      confidence: 'low',
    },
    breakdown: {
      crimeRisk: 0,
      lightingRisk: 0.5,
      communityRisk: 0,
      rawLightingRisk: 0.5,
      timeWindow: 'unknown',
      routeMeters: 0,
      sampleCount: 0,
      incidentsConsidered: 0,
      streetlightsConsidered: 0,
      communityReportsConsidered: 0,
      incidentSource: 'none',
    },
    sampledPoints: [],
  };
}

function scoreRoute(points, options = {}) {
  const normalized = normalizeScoreRouteOptions(options);
  const hour = Number.isFinite(normalized.hour) ? normalized.hour : getTorontoHour();
  const now = normalized.now instanceof Date ? normalized.now : new Date();
  const profile = timeProfile(hour);

  if (!Array.isArray(points) || points.length === 0) {
    return neutralScore('Route geometry was unavailable for scoring.');
  }

  const routeMeters = routeLengthMeters(points);
  const sampledPoints = sampleRouteByDistance(points, normalized.sampleSpacingMeters || SAMPLE_SPACING_METERS);
  if (sampledPoints.length === 0) {
    return neutralScore('Route geometry was unavailable for scoring.');
  }

  const bounds = routeBounds(sampledPoints, Math.max(INCIDENT_RADIUS_METERS, REPORT_RADIUS_METERS, STREETLIGHT_RADIUS_METERS));
  const grid = buildSampleGrid(sampledPoints, bounds.referenceLat);
  const rows = queryScoringRows(bounds, now);
  const routeKm = Math.max(routeMeters / 1000, 0.25);
  const nowMs = now.getTime();

  logScore('route candidates', {
    routeMeters: Math.round(routeMeters),
    sampleCount: sampledPoints.length,
    incidentSource: rows.incidentSource,
    incidentsConsidered: rows.incidents.length,
    streetlightsConsidered: rows.streetlights.length,
    communityReportsConsidered: rows.reports.length,
  });

  const crime = scoreIncidents({
    incidents: rows.incidents,
    grid,
    routeKm,
    sampleCount: sampledPoints.length,
    profile,
    nowMs,
  });
  const lighting = scoreStreetlights({
    streetlights: rows.streetlights,
    grid,
    routeMeters,
    sampleCount: sampledPoints.length,
    profile,
  });
  const community = scoreReports({
    reports: rows.reports,
    grid,
    routeKm,
    sampleCount: sampledPoints.length,
    profile,
    nowMs,
  });

  const baseRisk =
    profile.weights.crime * crime.crimeRisk +
    profile.weights.lighting * lighting.lightingRisk +
    profile.weights.community * community.communityRisk;
  const score = normalizeFinalRisk(baseRisk, profile.timeOfDayMultiplier);
  const dangerousSegments = computeDangerousSegments({
    sampleCount: sampledPoints.length,
    crime,
    lighting,
    community,
    profile,
  });
  const confidenceScore = computeConfidence({
    incidentSource: rows.incidentSource,
    incidentCount: rows.incidents.length,
    streetlightCount: rows.streetlights.length,
    reportCount: rows.reports.length,
    sampleCount: sampledPoints.length,
    routeMeters,
  });
  const explanation = makeExplanation({
    crime,
    lighting,
    community,
    profile,
    confidence: confidenceScore,
  });

  const breakdown = {
    crimeRisk: round4(crime.crimeRisk),
    lightingRisk: round4(lighting.lightingRisk),
    communityRisk: round4(community.communityRisk),
    rawLightingRisk: round4(lighting.rawLightingRisk),
    timeWindow: profile.label,
    routeMeters: Math.round(routeMeters),
    sampleCount: sampledPoints.length,
    incidentsConsidered: rows.incidents.length,
    streetlightsConsidered: rows.streetlights.length,
    communityReportsConsidered: rows.reports.length,
    incidentSource: rows.incidentSource,
    weightedIncidentsPerKm: Number(crime.weightedPerKm.toFixed(2)),
    weightedLightsPer100m: Number(lighting.lightsPer100m.toFixed(2)),
    weightedReportsPerKm: Number(community.weightedPerKm.toFixed(2)),
  };

  logScore('route score breakdown', {
    safetyScore: round4(score),
    crimeRisk: breakdown.crimeRisk,
    lightingRisk: breakdown.lightingRisk,
    communityRisk: breakdown.communityRisk,
    timeWindow: profile.label,
    timeOfDayMultiplier: profile.timeOfDayMultiplier,
    confidenceScore,
  });

  return {
    score,
    dangerousSegments,
    crimeRisk: crime.crimeRisk,
    lightingRisk: lighting.lightingRisk,
    communityRisk: community.communityRisk,
    timeOfDayMultiplier: profile.timeOfDayMultiplier,
    confidenceScore,
    explanation,
    breakdown,
    sampledPoints,
  };
}

function safetyCost(lat, lng, hour = getTorontoHour()) {
  return scoreRoute([{ lat, lng }], { hour }).score;
}

module.exports = {
  getTorontoHour,
  haversineMeters,
  safetyCost,
  sampleRouteByDistance,
  scoreRoute,
};

if (require.main === module) {
  const testRoutes = [
    {
      name: 'Queen and Sherbourne short walk',
      points: [
        { lat: 43.6519, lng: -79.3716 },
        { lat: 43.6544, lng: -79.3658 },
      ],
    },
    {
      name: 'Yorkville short walk',
      points: [
        { lat: 43.6708, lng: -79.3934 },
        { lat: 43.6735, lng: -79.3886 },
      ],
    },
    {
      name: 'Financial District short walk',
      points: [
        { lat: 43.6479, lng: -79.3815 },
        { lat: 43.6512, lng: -79.3769 },
      ],
    },
  ];

  for (const route of testRoutes) {
    const day = scoreRoute(route.points, { hour: 14 });
    const night = scoreRoute(route.points, { hour: 23 });
    console.log(route.name);
    console.log(`  2 PM:  ${day.score.toFixed(3)} crime=${day.crimeRisk.toFixed(3)} lighting=${day.lightingRisk.toFixed(3)} reports=${day.communityRisk.toFixed(3)} confidence=${day.confidenceScore.toFixed(2)}`);
    console.log(`  11 PM: ${night.score.toFixed(3)} crime=${night.crimeRisk.toFixed(3)} lighting=${night.lightingRisk.toFixed(3)} reports=${night.communityRisk.toFixed(3)} confidence=${night.confidenceScore.toFixed(2)}`);
    console.log(`  Factors: ${night.explanation.mainFactors.join('; ')}`);
    console.log();
  }
}
