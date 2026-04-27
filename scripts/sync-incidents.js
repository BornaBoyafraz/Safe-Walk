const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');

// Toronto Police Major Crime Indicators — ArcGIS Feature Service
// Docs: https://data.torontopolice.on.ca/datasets/major-crime-indicators-open-data
const BASE_URL =
  'https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/' +
  'Major_Crime_Indicators_Open_Data/FeatureServer/0/query';

// ArcGIS caps results at 2000 per request, so we paginate
const PAGE_SIZE = 2000;

async function fetchPage(offset) {
  const params = new URLSearchParams({
    where: '1=1',
    outFields: 'EVENT_UNIQUE_ID,LAT_WGS84,LONG_WGS84,CSI_CATEGORY,OFFENCE,OCC_DATE,REPORT_DATE,PREMISES_TYPE,NEIGHBOURHOOD_158',
    outSR: '4326',
    f: 'json',
    resultOffset: offset,
    resultRecordCount: PAGE_SIZE,
  });

  const url = `${BASE_URL}?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Toronto Police API returned ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

function epochToISO(epoch) {
  if (!epoch) return null;
  return new Date(epoch).toISOString();
}

async function syncAll() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const upsert = db.prepare(`
    INSERT INTO incidents (event_id, lat, lng, category, offence, occurred_at, reported_at, premise_type, neighbourhood, source)
    VALUES (@event_id, @lat, @lng, @category, @offence, @occurred_at, @reported_at, @premise_type, @neighbourhood, 'toronto_police')
    ON CONFLICT(event_id) DO UPDATE SET
      lat = @lat,
      lng = @lng,
      category = @category,
      offence = @offence,
      occurred_at = @occurred_at,
      reported_at = @reported_at,
      premise_type = @premise_type,
      neighbourhood = @neighbourhood
  `);

  let offset = 0;
  let totalInserted = 0;
  let totalSkipped = 0;

  console.log('Fetching Toronto Police Major Crime Indicators...');

  while (true) {
    const data = await fetchPage(offset);

    if (!data.features || data.features.length === 0) {
      break;
    }

    const batch = db.transaction((features) => {
      for (const f of features) {
        const a = f.attributes;

        // Skip records without coordinates — can't map them
        if (!a.LAT_WGS84 || !a.LONG_WGS84) {
          totalSkipped++;
          continue;
        }

        upsert.run({
          event_id: a.EVENT_UNIQUE_ID,
          lat: a.LAT_WGS84,
          lng: a.LONG_WGS84,
          category: a.CSI_CATEGORY,
          offence: a.OFFENCE,
          occurred_at: epochToISO(a.OCC_DATE),
          reported_at: epochToISO(a.REPORT_DATE),
          premise_type: a.PREMISES_TYPE,
          neighbourhood: a.NEIGHBOURHOOD_158,
        });
        totalInserted++;
      }
    });

    batch(data.features);

    console.log(`  Fetched ${data.features.length} records (offset ${offset})`);
    offset += PAGE_SIZE;

    // ArcGIS signals "no more pages" when exceededTransferLimit is false or absent
    if (!data.exceededTransferLimit) {
      break;
    }
  }

  console.log(`Done. ${totalInserted} incidents upserted, ${totalSkipped} skipped (no coordinates).`);

  const count = db.prepare('SELECT COUNT(*) as n FROM incidents').get();
  console.log(`Total incidents in database: ${count.n}`);

  db.close();
}

syncAll().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
