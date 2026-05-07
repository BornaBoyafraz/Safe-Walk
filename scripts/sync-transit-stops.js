const Database = require('better-sqlite3');
const path = require('path');
const { createWriteStream, readFileSync, unlinkSync, existsSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');

// GTFS feeds for all GTA transit agencies
// stops.txt format: stop_id,stop_name,stop_lat,stop_lon,...
const AGENCIES = [
  {
    name: 'TTC',
    url: 'https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/7795b45e-e65a-4465-81fc-c5b0dc4da400/resource/cfb6b2b8-6191-41e3-bfe1-ad69d2b4a282/download/TTC%20Routes%20and%20Schedules%20Data.zip',
    fallback: 'https://transitfeeds.com/p/ttc/33/latest/download',
  },
  {
    name: 'MiWay',
    url: 'https://www.mississauga.ca/google_transit.zip',
  },
  {
    name: 'BramptonTransit',
    url: 'https://www.brampton.ca/EN/residents/transit/about-transit/Documents/google_transit.zip',
  },
  {
    name: 'YRT',
    url: 'https://www.yrt.ca/google/google_transit.zip',
  },
  {
    name: 'DurhamTransit',
    url: 'https://www.durham.ca/en/regional-government/resources/Documents/Transit/GTFS.zip',
  },
  {
    name: 'OakvilleTransit',
    url: 'https://www.oakville.ca/getmedia/24b09a5c-0de2-4ade-875e-af6ff3feae1f/transit-GTFS-data.zip',
  },
];

// Parse stops.txt CSV without an external library
function parseStopsTxt(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const stopIdIdx  = headers.indexOf('stop_id');
  const nameIdx    = headers.indexOf('stop_name');
  const latIdx     = headers.indexOf('stop_lat');
  const lonIdx     = headers.indexOf('stop_lon');

  if (latIdx === -1 || lonIdx === -1 || stopIdIdx === -1) return [];

  const stops = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const lat = parseFloat(cols[latIdx]);
    const lng = parseFloat(cols[lonIdx]);
    if (!isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) continue;
    stops.push({
      stop_id: cols[stopIdIdx] || String(i),
      stop_name: nameIdx >= 0 ? (cols[nameIdx] || null) : null,
      lat,
      lng,
    });
  }
  return stops;
}

async function downloadZip(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SafeWalk/1.0 (transit data sync)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function extractStopsFromZip(zipBuffer) {
  // Use Node.js built-in zlib to try to read stops.txt from the zip.
  // For a proper zip, we'd need a library. We'll try a simple approach:
  // write to temp file and use child_process to extract.
  const tmpPath = join(tmpdir(), `gtfs_${Date.now()}.zip`);
  const { writeFileSync, mkdirSync } = require('fs');
  const { execSync } = require('child_process');

  const extractDir = join(tmpdir(), `gtfs_${Date.now()}`);

  writeFileSync(tmpPath, zipBuffer);
  mkdirSync(extractDir, { recursive: true });

  try {
    execSync(`unzip -o -j "${tmpPath}" stops.txt -d "${extractDir}"`, { stdio: 'pipe' });
    const stopsPath = join(extractDir, 'stops.txt');
    if (!existsSync(stopsPath)) throw new Error('stops.txt not found in zip');
    const content = readFileSync(stopsPath, 'utf-8');
    return parseStopsTxt(content);
  } finally {
    try { unlinkSync(tmpPath); } catch {}
    try { execSync(`rm -rf "${extractDir}"`, { stdio: 'pipe' }); } catch {}
  }
}

async function syncAgency(db, upsert, agency) {
  console.log(`  Fetching ${agency.name}...`);

  let zipBuffer;
  try {
    zipBuffer = await downloadZip(agency.url);
  } catch (err) {
    if (agency.fallback) {
      console.log(`    Primary URL failed (${err.message}), trying fallback...`);
      try {
        zipBuffer = await downloadZip(agency.fallback);
      } catch (err2) {
        console.warn(`    ${agency.name} unavailable: ${err2.message} — skipping`);
        return 0;
      }
    } else {
      console.warn(`    ${agency.name} unavailable: ${err.message} — skipping`);
      return 0;
    }
  }

  let stops;
  try {
    stops = await extractStopsFromZip(zipBuffer);
  } catch (err) {
    console.warn(`    Could not extract stops.txt from ${agency.name}: ${err.message} — skipping`);
    return 0;
  }

  if (stops.length === 0) {
    console.warn(`    No stops found in ${agency.name} GTFS feed`);
    return 0;
  }

  const batch = db.transaction((stops) => {
    for (const s of stops) {
      upsert.run({
        stop_id:   s.stop_id,
        stop_name: s.stop_name,
        lat:       s.lat,
        lng:       s.lng,
        agency:    agency.name,
      });
    }
  });

  batch(stops);
  console.log(`    ${stops.length} stops from ${agency.name}`);
  return stops.length;
}

async function syncAll() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  const upsert = db.prepare(`
    INSERT INTO transit_stops (stop_id, stop_name, lat, lng, agency)
    VALUES (@stop_id, @stop_name, @lat, @lng, @agency)
    ON CONFLICT(stop_id, agency) DO UPDATE SET
      stop_name = @stop_name,
      lat = @lat,
      lng = @lng
  `);

  console.log('Syncing GTA transit stops from GTFS feeds...');

  let total = 0;
  for (const agency of AGENCIES) {
    const count = await syncAgency(db, upsert, agency);
    total += count;
  }

  console.log(`\nDone. ${total} transit stops upserted across all agencies.`);
  const count = db.prepare('SELECT COUNT(*) as n FROM transit_stops').get();
  console.log(`Total transit stops in database: ${count.n}`);
  db.close();
}

syncAll().catch(err => {
  console.error('Transit sync failed:', err.message);
  process.exit(1);
});
