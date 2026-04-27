const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');

// Toronto topographic mapping poles dataset — CKAN datastore resource
// Filtered to SUBTYPE_CODE 6006 = "Street Light Pole"
const RESOURCE_ID = '0c258d50-a852-466a-8439-3192aa1af2e4';
const CKAN_DATASTORE_URL = 'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search';
const PAGE_SIZE = 10000;
const STREETLIGHT_SUBTYPE = 6006;

async function fetchPage(offset) {
  const params = new URLSearchParams({
    resource_id: RESOURCE_ID,
    filters: JSON.stringify({ SUBTYPE_CODE: STREETLIGHT_SUBTYPE }),
    limit: PAGE_SIZE,
    offset,
  });

  const res = await fetch(`${CKAN_DATASTORE_URL}?${params}`);
  if (!res.ok) {
    throw new Error(`CKAN datastore_search returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(`CKAN datastore_search failed: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

async function syncAll() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const upsert = db.prepare(`
    INSERT INTO streetlights (asset_id, lat, lng, type, wattage, status)
    VALUES (@asset_id, @lat, @lng, @type, @wattage, @status)
    ON CONFLICT(asset_id) DO UPDATE SET
      lat = @lat,
      lng = @lng,
      type = @type,
      wattage = @wattage,
      status = @status
  `);

  console.log('Fetching Toronto street light pole data from City open data...');

  // Get total count from first page
  const firstPage = await fetchPage(0);
  const total = firstPage.total;
  console.log(`Found ${total} street light poles. Fetching in pages of ${PAGE_SIZE}...`);

  let inserted = 0;
  let skipped = 0;
  let offset = 0;

  const processPage = db.transaction((records) => {
    for (const record of records) {
      // geometry is a JSON string: {"type": "Point", "coordinates": [lng, lat]}
      let lat = null;
      let lng = null;
      try {
        const geom = JSON.parse(record.geometry);
        if (geom && geom.coordinates && geom.coordinates.length >= 2) {
          lng = geom.coordinates[0];
          lat = geom.coordinates[1];
        }
      } catch {
        skipped++;
        continue;
      }

      if (lat === null || lng === null || !isFinite(lat) || !isFinite(lng)) {
        skipped++;
        continue;
      }

      upsert.run({
        asset_id: String(record.OBJECTID),
        lat,
        lng,
        type: record.SUBTYPE_DESC || null,
        wattage: null,  // not available in this topographic dataset
        status: null,   // not available in this topographic dataset
      });
      inserted++;
    }
  });

  // Process first page records
  processPage(firstPage.records);
  offset = PAGE_SIZE;
  console.log(`  Processed ${Math.min(offset, total)} of ${total}`);

  // Fetch remaining pages
  while (offset < total) {
    const page = await fetchPage(offset);
    processPage(page.records);
    offset += PAGE_SIZE;
    console.log(`  Processed ${Math.min(offset, total)} of ${total}`);
  }

  console.log(`Done. ${inserted} streetlights upserted, ${skipped} skipped (bad geometry).`);

  const count = db.prepare('SELECT COUNT(*) as n FROM streetlights').get();
  console.log(`Total streetlights in database: ${count.n}`);

  db.close();
}

syncAll().catch(err => {
  console.error('Streetlight sync failed:', err.message);
  process.exit(1);
});
