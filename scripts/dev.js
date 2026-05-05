require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { execSync } = require('child_process');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'safewalk.db');

function log(msg) {
  console.log(`[dev] ${msg}`);
}

function rowCount(table) {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    db.close();
    return row.count;
  } catch {
    return 0;
  }
}

// Step 1: Migration
log('Running migration...');
execSync('node scripts/migrate.js', { cwd: ROOT, stdio: 'inherit' });
log('Migration complete.');

// Step 2: Incidents
const incidentsBefore = rowCount('incidents');
if (incidentsBefore === 0) {
  log('Checking incidents... 0 rows found.');
  log('Syncing police incident data (this may take a few minutes)...');
  try {
    execSync('node scripts/sync-incidents.js', { cwd: ROOT, stdio: 'inherit' });
    log(`Incidents synced. ${rowCount('incidents').toLocaleString()} rows.`);
  } catch (err) {
    console.error('[dev] Incident sync failed:', err.message);
    log('Continuing with whatever data exists.');
  }
} else {
  log(`Checking incidents... ${incidentsBefore.toLocaleString()} rows found, skipping sync.`);
}

// Step 3: Streetlights
const lightsBefore = rowCount('streetlights');
if (lightsBefore === 0) {
  log('Checking streetlights... 0 rows found.');
  log('Syncing streetlight data (this may take a few minutes)...');
  try {
    execSync('node scripts/sync-streetlights.js', { cwd: ROOT, stdio: 'inherit' });
    log(`Streetlights synced. ${rowCount('streetlights').toLocaleString()} rows.`);
  } catch (err) {
    console.error('[dev] Streetlight sync failed:', err.message);
    log('Continuing with whatever data exists.');
  }
} else {
  log(`Checking streetlights... ${lightsBefore.toLocaleString()} rows found, skipping sync.`);
}

// Step 4: Start server (runs in the foreground; Ctrl+C stops everything)
log('Starting server...');
require('../server/app.js');
