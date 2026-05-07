const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');

// Durham Regional Police open data — ArcGIS Feature Service
// Source: https://data.durhampolice.ca/datasets/major-crime-indicators
const BASE_URL =
  'https://services.arcgis.com/4xh7pnuNExqpJGVY/arcgis/rest/services/' +
  'Durham_MCI/FeatureServer/0/query';

const PAGE_SIZE = 2000;

function normalizeCategory(raw) {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper.includes('ASSAULT') || upper.includes('VIOLENCE')) return 'Assault';
  if (upper.includes('SEXUAL')) return 'Sexual Violation';
  if (upper.includes('ROBBERY')) return 'Robbery';
  if (upper.includes('BREAK') || upper.includes('ENTER')) return 'Break and Enter';
  if (upper.includes('THEFT')) return 'Theft Over';
  if (upper.includes('AUTO') || upper.includes('VEHICLE')) return 'Auto Theft';
  return raw;
}

function epochToISO(epoch) {
  if (!epoch) return null;
  return new Date(epoch).toISOString();
}

async function fetchPage(offset) {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: '*',
    outSR: '4326',
    f: 'json',
    resultOffset: offset,
    resultRecordCount: PAGE_SIZE,
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`Durham Police API returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function syncAll() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const upsert = db.prepare(`
    INSERT INTO incidents (event_id, lat, lng, category, offence, occurred_at, reported_at, premise_type, neighbourhood, source)
    VALUES (@event_id, @lat, @lng, @category, @offence, @occurred_at, @reported_at, @premise_type, @neighbourhood, 'durham_police')
    ON CONFLICT(event_id) DO UPDATE SET
      lat = @lat, lng = @lng, category = @category, offence = @offence,
      occurred_at = @occurred_at, reported_at = @reported_at,
      premise_type = @premise_type, neighbourhood = @neighbourhood
  `);

  let offset = 0;
  let inserted = 0;
  let skipped = 0;

  console.log('Fetching Durham Regional Police Major Crime Indicators...');

  while (true) {
    let data;
    try {
      data = await fetchPage(offset);
    } catch (err) {
      console.error('Fetch failed:', err.message);
      console.error('Check that the Durham Police ArcGIS endpoint is publicly accessible.');
      process.exit(1);
    }

    if (!data.features || data.features.length === 0) break;

    const batch = db.transaction((features) => {
      for (const f of features) {
        const a = f.attributes;
        const lat = a.LAT_WGS84 ?? a.Latitude ?? a.LATITUDE ?? null;
        const lng = a.LONG_WGS84 ?? a.Longitude ?? a.LONGITUDE ?? null;

        if (!lat || !lng) { skipped++; continue; }

        const eventId = `durham_${a.OBJECTID ?? a.EVENT_UNIQUE_ID ?? a.ObjectId}`;

        upsert.run({
          event_id:      eventId,
          lat:           parseFloat(lat),
          lng:           parseFloat(lng),
          category:      normalizeCategory(a.CSI_CATEGORY ?? a.CATEGORY ?? a.OFFENCE_CATEGORY),
          offence:       a.OFFENCE ?? a.OFFENCE_TYPE ?? null,
          occurred_at:   epochToISO(a.OCC_DATE ?? a.OCCURRENCE_DATE),
          reported_at:   epochToISO(a.REPORT_DATE ?? a.REPORTED_DATE),
          premise_type:  a.PREMISES_TYPE ?? a.PREMISE_TYPE ?? null,
          neighbourhood: a.MUNICIPALITY ?? a.COMMUNITY ?? a.DIVISION ?? null,
        });
        inserted++;
      }
    });

    batch(data.features);
    console.log(`  Fetched ${data.features.length} records (offset ${offset})`);
    offset += PAGE_SIZE;

    if (!data.exceededTransferLimit) break;
  }

  console.log(`Done. ${inserted} Durham incidents upserted, ${skipped} skipped.`);
  const count = db.prepare("SELECT COUNT(*) as n FROM incidents WHERE source='durham_police'").get();
  console.log(`Total Durham incidents in database: ${count.n}`);
  db.close();
}

syncAll().catch(err => {
  console.error('Durham sync failed:', err.message);
  process.exit(1);
});
