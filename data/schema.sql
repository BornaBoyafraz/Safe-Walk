-- Safe Walk database schema
-- Run via: npm run migrate

CREATE TABLE IF NOT EXISTS incidents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id      TEXT UNIQUE,          -- source event unique ID, for upsert dedup
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  category      TEXT NOT NULL,        -- e.g. Assault, Robbery, Break and Enter
  offence       TEXT,
  occurred_at   TEXT,                 -- ISO 8601 datetime
  reported_at   TEXT,
  premise_type  TEXT,
  neighbourhood TEXT,
  source        TEXT DEFAULT 'toronto_police'
);

CREATE TABLE IF NOT EXISTS streetlights (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id      TEXT UNIQUE,          -- source asset ID, for upsert dedup
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
  verified      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transit_stops (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  stop_id       TEXT NOT NULL,
  stop_name     TEXT,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  agency        TEXT NOT NULL,
  UNIQUE(stop_id, agency)
);

CREATE TABLE IF NOT EXISTS census_density (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  da_id         TEXT UNIQUE,          -- StatsCan dissemination area ID
  lat           REAL NOT NULL,        -- DA centroid
  lng           REAL NOT NULL,
  population    INTEGER,
  area_sqkm     REAL,
  density       REAL                  -- people per km²
);

CREATE TABLE IF NOT EXISTS road_segments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  osm_id        TEXT UNIQUE,
  lat           REAL NOT NULL,        -- midpoint of segment
  lng           REAL NOT NULL,
  highway       TEXT,                 -- OSM highway tag value
  name          TEXT
);

CREATE TABLE IF NOT EXISTS service_calls (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id       TEXT UNIQUE,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  category      TEXT,
  occurred_at   TEXT,
  source        TEXT DEFAULT 'toronto_311'
);

-- Spatial lookups happen constantly for map overlays and route context
CREATE INDEX IF NOT EXISTS idx_incidents_lat_lng      ON incidents(lat, lng);
CREATE INDEX IF NOT EXISTS idx_incidents_occurred     ON incidents(occurred_at);
CREATE INDEX IF NOT EXISTS idx_incidents_source       ON incidents(source);
CREATE INDEX IF NOT EXISTS idx_streetlights_lat_lng   ON streetlights(lat, lng);
CREATE INDEX IF NOT EXISTS idx_user_reports_lat_lng   ON user_reports(lat, lng);
CREATE INDEX IF NOT EXISTS idx_transit_lat_lng        ON transit_stops(lat, lng);
CREATE INDEX IF NOT EXISTS idx_census_lat_lng         ON census_density(lat, lng);
CREATE INDEX IF NOT EXISTS idx_roads_lat_lng          ON road_segments(lat, lng);
CREATE INDEX IF NOT EXISTS idx_service_calls_lat_lng  ON service_calls(lat, lng);
CREATE INDEX IF NOT EXISTS idx_service_calls_occurred ON service_calls(occurred_at);
