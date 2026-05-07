const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');

// OpenStreetMap road classification data via Overpass API
// Fetches road segment midpoints and highway tags for the GTA
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Highway types relevant to pedestrian safety scoring
const ROAD_TYPES = [
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
  'residential', 'service', 'path', 'footway', 'track',
  'unclassified', 'living_street',
].join('|');

// GTA bounding box: south,west,north,east
const GTA_BBOX = '43.40,-80.00,44.10,-78.90';

// Overpass QL query — get all roads in GTA with highway tags
// We limit to avoid overwhelming the public API
function buildQuery() {
  return `
[out:json][timeout:120];
(
  way["highway"~"^(${ROAD_TYPES})$"](${GTA_BBOX});
);
out center tags;
`.trim();
}

async function fetchRoads() {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(buildQuery())}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Overpass API returned ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.elements || [];
}

async function syncAll() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const upsert = db.prepare(`
    INSERT INTO road_segments (osm_id, lat, lng, highway, name)
    VALUES (@osm_id, @lat, @lng, @highway, @name)
    ON CONFLICT(osm_id) DO UPDATE SET
      lat = @lat, lng = @lng, highway = @highway, name = @name
  `);

  console.log('Fetching GTA road classification data from OpenStreetMap Overpass API...');
  console.log('(This may take 1-3 minutes — the query covers the entire GTA)');

  let elements;
  try {
    elements = await fetchRoads();
  } catch (err) {
    console.error('Overpass fetch failed:', err.message);
    console.error('The public Overpass API may be rate-limiting. Try again in a few minutes.');
    process.exit(1);
  }

  console.log(`Received ${elements.length} road elements. Inserting...`);

  let inserted = 0;
  let skipped = 0;

  const batch = db.transaction((elements) => {
    for (const el of elements) {
      // `out center` gives us the centroid of each way
      const lat = el.center?.lat ?? null;
      const lng = el.center?.lon ?? null;
      const highway = el.tags?.highway ?? null;

      if (!lat || !lng || !highway) { skipped++; continue; }

      upsert.run({
        osm_id:  String(el.id),
        lat,
        lng,
        highway,
        name:    el.tags?.name ?? null,
      });
      inserted++;
    }
  });

  batch(elements);

  console.log(`Done. ${inserted} road segments upserted, ${skipped} skipped.`);
  const count = db.prepare('SELECT COUNT(*) as n FROM road_segments').get();
  console.log(`Total road segments in database: ${count.n}`);

  // Show breakdown by highway type
  const breakdown = db.prepare('SELECT highway, COUNT(*) as n FROM road_segments GROUP BY highway ORDER BY n DESC').all();
  console.log('\nBreakdown by road type:');
  for (const row of breakdown) {
    console.log(`  ${row.highway}: ${row.n}`);
  }

  db.close();
}

syncAll().catch(err => {
  console.error('Road classification sync failed:', err.message);
  process.exit(1);
});
