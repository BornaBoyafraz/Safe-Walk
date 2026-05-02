# Safe Walk

The safety layer for urban navigation. A Safety API built on top of Google Maps that scores walking routes using police incident data, streetlight coverage, and community reports.

---

## What it does

Safe Walk adds what Google Maps is missing: a real-time safety score for every street segment. It sits on top of the Google Routes API, requests multiple walking route alternatives, and scores each one against a safety graph built from Toronto Police incident data (~tens of thousands of geocoded crimes), City of Toronto streetlight locations (~160,000 points), community reports, and an AI risk estimation layer for data-sparse areas.

The API returns the fastest route and the safest route. The consumer demo shows both on a dark-themed Google Map with a toggle to switch between them. Users can also view a crime heatmap overlay, see streetlight coverage at high zoom, and submit community safety reports.

## How the safety scoring works

Each point along a route gets a danger cost between 0 (safe) and 1 (dangerous), computed from: incident density (distance-weighted, recency-decayed, severity-adjusted), streetlight density within 100m, and time-of-day weighting (lighting matters more at night). The route's overall score is the average of all sampled points.

## Tech stack

- Backend: Node.js, Express, SQLite (better-sqlite3)
- Frontend: Vanilla JS, Tailwind CSS, Google Maps JavaScript API
- APIs: Google Routes API, Google Places Autocomplete
- AI: Claude Haiku for risk estimation in data-sparse areas
- Data: Toronto Police Open Data, City of Toronto Open Data

## Getting started

```bash
git clone https://github.com/BornaBoyafraz/Safe-Walk.git
cd Safe-Walk
npm install
cp .env.example .env
# Add your Google Maps API key to .env
npm run migrate
npm run sync
npm run sync-lights
npm start
# Open http://localhost:3000
```

## API endpoints

- `POST /api/route` — returns fastest and safest walking routes
- `GET /api/incidents` — all crime incidents as GeoJSON
- `GET /api/streetlights` — streetlights in bounding box as GeoJSON
- `GET /api/safety-score` — safety cost for a single point
- `POST /api/report` — submit a community safety report
- `GET /api/reports` — recent community reports as GeoJSON

## Data sources

- Toronto Police Service, Major Crime Indicators
- City of Toronto, Street Lighting
- Community reports from users

---

**Built by:** Seyedborna Boyafraz  
**Project:** TKS Moonshot 2026
