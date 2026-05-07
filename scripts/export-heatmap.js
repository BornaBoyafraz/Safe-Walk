const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');
const OUT_DIR = path.join(__dirname, '..', 'public', 'data');
const OUT_PATH = path.join(OUT_DIR, 'heatmap.json');

function incidentWeight(row) {
  const text = `${row.category || ''} ${row.offence || ''}`.toLowerCase();
  if (/homicide|shooting|firearm|sexual|weapon|mugging|robbery/.test(text)) return 3.1;
  if (/assault bodily harm|assault with weapon/.test(text)) return 2.6;
  if (/assault/.test(text)) return 1.9;
  if (/break|enter|b&e/.test(text)) return 1.35;
  if (/theft over|auto theft|motor vehicle/.test(text)) return 1.15;
  return 1;
}

try {
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare(`
    SELECT lat, lng, category, offence FROM incidents
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND lat != 0 AND lng != 0
      AND occurred_at >= datetime('now', '-2 years')
  `).all().map(row => ({
    lat: row.lat,
    lng: row.lng,
    weight: Number(incidentWeight(row).toFixed(2)),
  }));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(rows));
  console.log(`Exported ${rows.length} heatmap points to ${OUT_PATH}`);
  db.close();
} catch (err) {
  console.warn('Heatmap export skipped:', err.message);
}
