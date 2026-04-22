use Opus 4.6 for planning, else Sonnet 4.6, write codes like professional humans(Don't delete this line)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here every session

1. Read `prompt.MD` — it is the source of truth for what Safe Walk is and what to build next.
2. Never hardcode API keys. Ask Borna for any key you need before using it.
3. Commit after each numbered step in the session scope with a real sentence commit message.

## Project

Safe Walk finds **safer** walking routes in Toronto (not just fastest). Users enter start + destination; the app computes a safety-scored route using police incident density and streetlight density, and displays it side-by-side with the fastest route on a Mapbox map.

TKS Moonshot. Pitch at TKS showcase May 7, 2026.

## Stack

- **Backend**: Node.js + Express
- **Database**: SQLite via `better-sqlite3`
- **Frontend**: Vanilla JS + Tailwind CSS (CDN)
- **Maps**: Mapbox GL JS
- **Geocoding**: Mapbox Geocoding API
- **Safe route algorithm**: Weighted A* over an OpenStreetMap road graph (fetched via Overpass/osmnx). OSRM public demo server for the fastest-route baseline.
- **AI (later)**: Claude API for natural-language route summaries. Not AI-first.

## Folder layout

```
server/      Express app and route handlers
public/      Static frontend (HTML, JS, CSS)
data/        SQLite database files and schema.sql
scripts/     One-off scripts: migrate, data sync
```

## Commands

```bash
npm start        # Start Express on port 3000
npm run migrate  # Apply data/schema.sql idempotently (node scripts/migrate.js)
npm run sync     # Fetch Toronto Police crime data (node scripts/sync-incidents.js)
```

## Data sources

- Toronto Police Open Data, Major Crime Indicators: https://data.torontopolice.on.ca
- City of Toronto Open Data, streetlights: https://open.toronto.ca
- OpenStreetMap road graph (Overpass API)

## Database schema

Three tables — `incidents`, `streetlights`, `user_reports`. See `data/schema.sql`.

## Code style

- Names that read like English. Comments only for non-obvious WHY.
- Small focused files. Real, specific error messages.
- No emojis anywhere. Commit messages are real sentences.
- `.env.example` committed, `.env` never committed.
- Prettier defaults.