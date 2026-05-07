require('dotenv').config();
const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const { computeRoutes } = require('./routes-api');

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = path.join(__dirname, '..', 'data', 'safewalk.db');
let db;
try {
  // Not readonly — needed to insert user reports
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.warn('Database not found. Run `npm run migrate` and `npm run sync` first.');
}

function incidentHeatmapWeight(row) {
  const text = `${row.category || ''} ${row.offence || ''}`.toLowerCase();
  if (/homicide|shooting|firearm|sexual|weapon|mugging|robbery/.test(text)) return 3.1;
  if (/assault bodily harm|assault with weapon/.test(text)) return 2.6;
  if (/assault/.test(text)) return 1.9;
  if (/break|enter|b&e/.test(text)) return 1.35;
  if (/theft over|auto theft|motor vehicle/.test(text)) return 1.15;
  return 1;
}

app.use(express.json());

app.get('/api/config', (req, res) => {
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const localFallback =
    process.env.NODE_ENV !== 'production'
      ? process.env.GOOGLE_MAPS_API_KEY || ''
      : '';

  res.json({
    googleMapsApiKey: browserKey || localFallback,
    source: browserKey ? 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY' : localFallback ? 'GOOGLE_MAPS_API_KEY_DEV_FALLBACK' : 'missing',
  });
});

app.get('/api/incidents/heatmap', (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not initialized.' });

  const rows = db.prepare(`
    SELECT lat, lng, category, offence FROM incidents
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND lat != 0 AND lng != 0
      AND occurred_at >= datetime('now', '-2 years')
  `).all().map(row => ({
    lat: row.lat,
    lng: row.lng,
    weight: Number(incidentHeatmapWeight(row).toFixed(2)),
  }));

  res.set('Cache-Control', 'public, max-age=3600');
  res.json(rows);
});

app.get('/api/incidents', (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not initialized. Run npm run migrate && npm run sync.' });
  }

  const rows = db.prepare(`
    SELECT lat, lng, category, offence, occurred_at, premise_type, neighbourhood
    FROM incidents
    WHERE lat IS NOT NULL AND lng IS NOT NULL
      AND lat != 0 AND lng != 0
  `).all();

  res.json({
    type: 'FeatureCollection',
    features: rows.map(row => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [row.lng, row.lat] },
      properties: {
        category: row.category,
        offence: row.offence,
        occurred_at: row.occurred_at,
        premise_type: row.premise_type,
        neighbourhood: row.neighbourhood,
      },
    })),
  });
});

app.get('/api/streetlights', (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not initialized.' });
  }

  const { minLat, maxLat, minLng, maxLng } = req.query;

  if (!minLat || !maxLat || !minLng || !maxLng) {
    return res.status(400).json({ error: 'minLat, maxLat, minLng, maxLng are all required.' });
  }

  const min_lat = parseFloat(minLat);
  const max_lat = parseFloat(maxLat);
  const min_lng = parseFloat(minLng);
  const max_lng = parseFloat(maxLng);

  if ([min_lat, max_lat, min_lng, max_lng].some(n => !isFinite(n))) {
    return res.status(400).json({ error: 'Bounding box parameters must be valid numbers.' });
  }

  if (max_lat <= min_lat || max_lng <= min_lng) {
    return res.status(400).json({ error: 'maxLat must be greater than minLat, and maxLng greater than minLng.' });
  }

  const rows = db.prepare(`
    SELECT lat, lng, type, wattage, status
    FROM streetlights
    WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
  `).all(min_lat, max_lat, min_lng, max_lng);

  if (rows.length > 5000) {
    console.warn(`Streetlights query returned ${rows.length} features. Consider a tighter bounding box.`);
  }

  res.json({
    type: 'FeatureCollection',
    features: rows.map(row => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [row.lng, row.lat] },
      properties: {
        type: row.type,
        wattage: row.wattage,
        status: row.status,
      },
    })),
  });
});

app.post('/api/route', async (req, res) => {
  try {
    const origin = typeof req.body?.origin === 'string' ? req.body.origin.trim() : '';
    const destination = typeof req.body?.destination === 'string' ? req.body.destination.trim() : '';

    if (!origin || !destination) {
      return res.status(400).json({
        error: 'Both origin and destination are required as strings.',
        code: 'INVALID_ROUTE_REQUEST',
      });
    }

    console.log('[route] route request received', {
      originChars: origin.length,
      destinationChars: destination.length,
    });

    const result = await computeRoutes(origin, destination);
    res.json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    console.error('[route] route request failed', {
      code: err.code || 'UNHANDLED_ROUTE_ERROR',
      statusCode,
      message: err.message,
      details: err.details,
    });

    res.status(statusCode).json({
      error: err.message || 'Route computation failed.',
      code: err.code || 'UNHANDLED_ROUTE_ERROR',
      details: err.details,
    });
  }
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Safe Walk running at http://localhost:${PORT}`);
});
