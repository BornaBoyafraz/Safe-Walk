const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');

// Toronto 311 Service Requests (Customer-Initiated)
// Source: https://open.toronto.ca/dataset/311-service-requests-customer-initiated/
// CKAN resource ID for the most recent year
const CKAN_BASE = 'https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search';
const RESOURCE_ID = 'ea3b2fc3-2e24-4828-a862-fb0a0beb87da';  // 311 service requests

const PAGE_SIZE = 5000;

// Rough geocoding for 311 records — City of Toronto ward/neighbourhood centroids
// 311 records don't always have lat/lng, so we need the ones that do.
const SAFETY_CATEGORIES = new Set([
  'Assault', 'Robbery', 'Suspicious', 'Noise', 'Graffiti',
  'Encampment', 'Public Nuisance', 'Violence', 'Harassment',
  'Break', 'Theft',
]);

function categorizecall(serviceType) {
  if (!serviceType) return 'Other';
  const s = serviceType.toLowerCase();
  if (s.includes('assault') || s.includes('violence') || s.includes('shooting')) return 'Assault';
  if (s.includes('suspicious')) return 'Suspicious';
  if (s.includes('encampment') || s.includes('homeless')) return 'Encampment';
  if (s.includes('noise')) return 'Noise';
  if (s.includes('graffiti')) return 'Graffiti';
  if (s.includes('break') || s.includes('theft') || s.includes('robbery')) return 'Robbery';
  return 'Other';
}

async function fetchPage(offset) {
  const params = new URLSearchParams({
    resource_id: RESOURCE_ID,
    limit: PAGE_SIZE,
    offset,
  });

  const res = await fetch(`${CKAN_BASE}?${params}`);
  if (!res.ok) {
    throw new Error(`CKAN API returned ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.success) throw new Error(`CKAN error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function syncAll() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const upsert = db.prepare(`
    INSERT INTO service_calls (call_id, lat, lng, category, occurred_at, source)
    VALUES (@call_id, @lat, @lng, @category, @occurred_at, 'toronto_311')
    ON CONFLICT(call_id) DO UPDATE SET
      lat = @lat, lng = @lng, category = @category, occurred_at = @occurred_at
  `);

  console.log('Fetching Toronto 311 service requests...');

  let offset = 0;
  let inserted = 0;
  let skipped = 0;

  // Get total on first page
  let firstPage;
  try {
    firstPage = await fetchPage(0);
  } catch (err) {
    console.error('Failed to fetch 311 data:', err.message);
    console.error('Check the CKAN resource ID at open.toronto.ca/dataset/311-service-requests-customer-initiated/');
    process.exit(1);
  }

  const total = firstPage.total;
  console.log(`Found ${total} records. Fetching with lat/lng only...`);

  const processBatch = db.transaction((records) => {
    for (const r of records) {
      // Only import records that have geocoded coordinates
      const lat = parseFloat(r.Latitude ?? r.latitude ?? r.LAT ?? r.lat);
      const lng = parseFloat(r.Longitude ?? r.longitude ?? r.LONG ?? r.lng);

      if (!isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) {
        skipped++;
        continue;
      }

      // Filter to GTA bounding box
      if (lat < 43.4 || lat > 44.1 || lng < -80.0 || lng > -78.9) {
        skipped++;
        continue;
      }

      const callId = String(r.id ?? r.Service_Request_ID ?? r.SR_ID ?? `311_${offset}_${inserted}`);
      const serviceType = r.Service_Request_Type ?? r.Service_Name ?? r.Type ?? null;
      const dateStr = r.Creation_Date ?? r.Opened_Date ?? r.Date ?? null;

      let occurredAt = null;
      if (dateStr) {
        try { occurredAt = new Date(dateStr).toISOString(); } catch {}
      }

      upsert.run({
        call_id:     callId,
        lat,
        lng,
        category:    categorizecall(serviceType),
        occurred_at: occurredAt,
      });
      inserted++;
    }
  });

  processBatch(firstPage.records);
  offset = PAGE_SIZE;

  while (offset < total) {
    let page;
    try {
      page = await fetchPage(offset);
    } catch (err) {
      console.warn(`Page at offset ${offset} failed: ${err.message} — stopping`);
      break;
    }
    if (!page.records || page.records.length === 0) break;
    processBatch(page.records);
    offset += PAGE_SIZE;
    console.log(`  Processed ${Math.min(offset, total)} of ${total}`);
  }

  console.log(`Done. ${inserted} service calls upserted, ${skipped} skipped (no coordinates).`);
  const count = db.prepare('SELECT COUNT(*) as n FROM service_calls').get();
  console.log(`Total service calls in database: ${count.n}`);
  db.close();
}

syncAll().catch(err => {
  console.error('311 sync failed:', err.message);
  process.exit(1);
});
