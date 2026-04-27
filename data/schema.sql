-- Safe Walk database schema
-- Run via: npm run migrate

CREATE TABLE IF NOT EXISTS incidents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id      TEXT UNIQUE,          -- Toronto Police event unique ID, for upsert dedup
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  category      TEXT NOT NULL,        -- e.g. Assault, Robbery, Break and Enter
  offence       TEXT,                 -- specific offence description
  occurred_at   TEXT,                 -- ISO 8601 datetime
  reported_at   TEXT,                 -- when it was reported to police
  premise_type  TEXT,                 -- Outside, Apartment, House, Commercial, etc.
  neighbourhood TEXT,                 -- Toronto neighbourhood name
  source        TEXT DEFAULT 'toronto_police'
);

CREATE TABLE IF NOT EXISTS streetlights (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id      TEXT UNIQUE,          -- City of Toronto asset ID, for upsert dedup
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  type          TEXT,                 -- LED, HPS, etc.
  wattage       REAL,
  status        TEXT                  -- Active, Inactive
);

CREATE TABLE IF NOT EXISTS user_reports (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  category      TEXT NOT NULL,        -- harassment, poor_lighting, suspicious_activity, other
  note          TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  verified      INTEGER DEFAULT 0     -- 0 = unverified, 1 = corroborated
);

-- Spatial lookups happen constantly during scoring, so index on lat/lng
CREATE INDEX IF NOT EXISTS idx_incidents_lat_lng ON incidents(lat, lng);
CREATE INDEX IF NOT EXISTS idx_incidents_occurred ON incidents(occurred_at);
CREATE INDEX IF NOT EXISTS idx_streetlights_lat_lng ON streetlights(lat, lng);
CREATE INDEX IF NOT EXISTS idx_user_reports_lat_lng ON user_reports(lat, lng);
