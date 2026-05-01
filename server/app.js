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

app.use(express.json());

app.get('/api/config', (req, res) => {
  res.json({ googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY });
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
  const { origin, destination } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'Both origin and destination are required.' });
  }

  try {
    const result = await computeRoutes(origin, destination);
    res.json(result);
  } catch (err) {
    console.error('Route computation failed:', err.message);

    if (err.message.includes('could not find a route')) {
      return res.status(422).json({ error: err.message });
    }
    if (err.message.includes('API key not configured')) {
      return res.status(503).json({ error: err.message });
    }
    res.status(502).json({ error: `Route computation failed: ${err.message}` });
  }
});

const VALID_REPORT_CATEGORIES = ['harassment', 'poor_lighting', 'suspicious_activity', 'other'];

app.post('/api/report', (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not initialized.' });
  }

  const { lat, lng, category, note } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number' || !isFinite(lat) || !isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng must be finite numbers.' });
  }
  if (!VALID_REPORT_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_REPORT_CATEGORIES.join(', ')}.` });
  }
  if (note !== undefined && typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be a string.' });
  }

  const result = db.prepare(`
    INSERT INTO user_reports (lat, lng, category, note) VALUES (?, ?, ?, ?)
  `).run(lat, lng, category, note?.trim() || null);

  res.status(201).json({ id: result.lastInsertRowid });
});

app.get('/api/reports', (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not initialized.' });
  }

  // Return reports from the last 90 days
  const rows = db.prepare(`
    SELECT lat, lng, category, note, created_at
    FROM user_reports
    WHERE created_at >= datetime('now', '-90 days')
    ORDER BY created_at DESC
  `).all();

  res.json({
    type: 'FeatureCollection',
    features: rows.map(row => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [row.lng, row.lat] },
      properties: { category: row.category, note: row.note, created_at: row.created_at },
    })),
  });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Safe Walk running at http://localhost:${PORT}`);
});
