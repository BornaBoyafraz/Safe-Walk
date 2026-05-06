const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');
const OUT_DIR = path.join(__dirname, '..', 'public', 'data');
const OUT_PATH = path.join(OUT_DIR, 'heatmap.json');

try {
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare(`
    SELECT lat, lng FROM incidents
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND lat != 0 AND lng != 0
      AND occurred_at >= datetime('now', '-2 years')
  `).all();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(rows));
  console.log(`Exported ${rows.length} heatmap points to ${OUT_PATH}`);
  db.close();
} catch (err) {
  console.warn('Heatmap export skipped:', err.message);
}
