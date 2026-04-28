use Opus 4.6 for planning, else Sonnet 4.6, write codes like professional humans. Use UI-UX-Pro_Max for UI of the website(Don't delete this line)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here every session

1. Read `prompt.MD` — it is the source of truth for what Safe Walk is and what to build next.
2. Never hardcode API keys. Ask Borna for any key you need before using it.
3. Commit after each numbered step in the session scope with a real sentence commit message.

## Project

Safe Walk is a **Safety API built on top of Google Maps**. It adds a "safest route" option to any app using Google Maps routing. The API scores walking routes using police incident density, streetlight coverage, community reports, and AI risk predictions. A demo frontend shows a toggle between "fastest" and "safest" routes on a Google Map.

TKS Moonshot. Pitch at Deloitte, May 9-10, 2026. All deliverables due May 7.

## Stack

- **Backend**: Node.js + Express
- **Database**: SQLite via `better-sqlite3`
- **Frontend**: Vanilla JS + Tailwind CSS (CDN)
- **Maps**: Google Maps JavaScript API
- **Routing**: Google Routes API (computeAlternativeRoutes for multiple paths, scored by safety engine)
- **Geocoding**: Google Places Autocomplete
- **Safety scoring**: Custom engine — incident density + streetlight density + time-of-day weighting
- **AI (later)**: Claude API for risk prediction in data-sparse areas. Not AI-first.

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
npm run sync-lights  # Fetch Toronto streetlight data (node scripts/sync-streetlights.js)
```

## Data sources

- Toronto Police Open Data, Major Crime Indicators: https://data.torontopolice.on.ca
- City of Toronto Open Data, streetlights: https://open.toronto.ca

## Database schema

Three tables — `incidents`, `streetlights`, `user_reports`. See `data/schema.sql`.

## Code style

- Names that read like English. Comments only for non-obvious WHY.
- Small focused files. Real, specific error messages.
- No emojis anywhere. Commit messages are real sentences.
- `.env.example` committed, `.env` never committed.
- Prettier defaults.