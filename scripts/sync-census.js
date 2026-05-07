const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');

// StatsCan 2021 Census Dissemination Areas — population density
// This uses the Statistics Canada geographic attribute file which has
// DA centroids, population, and area pre-computed.
//
// Dataset: 2021 Census — Boundary files with population
// Source: https://www12.statcan.gc.ca/census-recensement/2021/geo/aip-pia/attribute-attribs/index2021-eng.cfm
//
// We use the ArcGIS REST API from the Statistics Canada geospatial hub
// which provides DA-level population and area data without needing to
// download and process large CSV/shapefile archives.
const BASE_URL =
  'https://geoappext.nrcan.gc.ca/arcgis/rest/services/StatsCan/cdadissemination2021/MapServer/0/query';

const PAGE_SIZE = 2000;

// GTA bounding box (approximate)
const GTA_BBOX = {
  minLat: 43.40, maxLat: 44.10,
  minLng: -80.00, maxLng: -78.90,
};

async function fetchPage(offset) {
  const params = new URLSearchParams({
    where: `Y > ${GTA_BBOX.minLat} AND Y < ${GTA_BBOX.maxLat} AND X > ${GTA_BBOX.minLng} AND X < ${GTA_BBOX.maxLng}`,
    outFields: 'DAUID,PRUID,POP_TOTAL,AREA_SQ_KM,X,Y',
    outSR: '4326',
    f: 'json',
    resultOffset: offset,
    resultRecordCount: PAGE_SIZE,
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`StatsCan API returned ${res.status}: ${await res.text()}`);
  return res.json();
}

async function syncAll() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const upsert = db.prepare(`
    INSERT INTO census_density (da_id, lat, lng, population, area_sqkm, density)
    VALUES (@da_id, @lat, @lng, @population, @area_sqkm, @density)
    ON CONFLICT(da_id) DO UPDATE SET
      lat = @lat, lng = @lng,
      population = @population, area_sqkm = @area_sqkm, density = @density
  `);

  let offset = 0;
  let inserted = 0;
  let skipped = 0;

  console.log('Fetching StatsCan 2021 census dissemination area density data...');

  while (true) {
    let data;
    try {
      data = await fetchPage(offset);
    } catch (err) {
      console.error('Fetch failed:', err.message);
      console.error('If the ArcGIS endpoint is unavailable, download the DA boundary file manually from:');
      console.error('https://www12.statcan.gc.ca/census-recensement/2021/geo/aip-pia/attribute-attribs/index2021-eng.cfm');
      process.exit(1);
    }

    if (!data.features || data.features.length === 0) break;

    const batch = db.transaction((features) => {
      for (const f of features) {
        const a = f.attributes;
        const lat = parseFloat(a.Y ?? (f.geometry && f.geometry.y));
        const lng = parseFloat(a.X ?? (f.geometry && f.geometry.x));

        if (!isFinite(lat) || !isFinite(lng)) { skipped++; continue; }

        const population = parseInt(a.POP_TOTAL, 10) || 0;
        const areaSqKm   = parseFloat(a.AREA_SQ_KM) || null;
        const density    = areaSqKm && areaSqKm > 0 ? population / areaSqKm : null;

        upsert.run({
          da_id:      String(a.DAUID),
          lat,
          lng,
          population,
          area_sqkm:  areaSqKm,
          density,
        });
        inserted++;
      }
    });

    batch(data.features);
    console.log(`  Fetched ${data.features.length} DAs (offset ${offset})`);
    offset += PAGE_SIZE;

    if (!data.exceededTransferLimit) break;
  }

  console.log(`Done. ${inserted} dissemination areas upserted, ${skipped} skipped.`);
  const count = db.prepare('SELECT COUNT(*) as n FROM census_density').get();
  console.log(`Total DAs in database: ${count.n}`);
  db.close();
}

syncAll().catch(err => {
  console.error('Census sync failed:', err.message);
  process.exit(1);
});
