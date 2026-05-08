# Safe Walk

Safe Walk is a safety layer for pedestrian navigation. It compares the fastest walking route with the safest walking route using Google Maps routing plus a custom safety engine built from incident density, streetlight coverage, community reports, and time-of-day weighting.

The product is designed as calm urban mobility infrastructure, not a crime app, police dashboard, or emergency alert tool.

## What Safe Walk Does

Safe Walk adds route safety intelligence on top of Google Maps:

- Requests walking route alternatives from the Google Routes API.
- Samples each route polyline into points along the path.
- Scores those points using nearby incidents, lighting coverage, reports, road context, and time of day.
- Returns both the fastest route and the safest route so users can compare the tradeoff.
- Shows the comparison in a polished demo with route switching, safety scoring, and an incident heatmap.

## Current App

The repository contains a Next.js website and demo frontend, plus Node/Vercel API handlers backed by the same route scoring engine used by the Express server.

Key pages:

- `/` - product overview
- `/demo` - interactive route comparison demo
- `/how-it-works` - scoring flow and API shape
- `/about` - project context
- `/partners` - partner positioning

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- UI: shadcn-style components, lucide-react icons, motion animations
- Maps: Google Maps JavaScript API
- Routing: Google Routes API
- Backend: Node.js API handlers and Express support server
- Database: SQLite with `better-sqlite3`
- Data: Toronto Police open data, City of Toronto streetlights, regional incident sync scripts, community report schema

## Safety Scoring

Each route is decoded, sampled, and scored using:

- Incident density with distance weighting, recency decay, and severity weighting
- Streetlight density, weighted more heavily at night
- Community safety report signals
- Time-of-day adjustments
- Route-level aggregation into a safety score and risk breakdown

Safe Walk is safety-informed navigation. It does not guarantee personal safety and should not be treated as emergency, legal, policing, or security advice.

## Authorized Local Setup

These setup steps are for approved collaborators only. They do not grant permission to copy, reuse, or redistribute the project.

```bash
git clone https://github.com/BornaBoyafraz/Safe-Walk.git
cd Safe-Walk
npm install
cp .env.example .env
```

Add a Google Maps API key to `.env`:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

For local development:

```bash
npm run dev
```

Open `http://localhost:3001`.

For the Express support server:

```bash
npm run migrate
npm run sync
npm run sync-lights
npm start
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` - start the Next.js app on port 3001
- `npm run build` - build the Next.js app
- `npm run serve` - serve the built Next.js app on port 3001
- `npm start` - start the Express server on port 3000
- `npm run dev:server` - migrate, sync missing local data, then start Express
- `npm run migrate` - apply the SQLite schema
- `npm run sync` - sync Toronto Police incident data
- `npm run sync-lights` - sync Toronto streetlight data
- `npm run sync-all` - run all configured data sync jobs

## API Endpoints

- `GET /api/config` - returns the browser Google Maps key configuration
- `POST /api/route` - returns fastest and safest walking routes
- `GET /api/incidents/heatmap` - returns incident heatmap points
- `GET /api/incidents` - Express endpoint for incidents as GeoJSON
- `GET /api/streetlights` - streetlights endpoint; the Vercel handler currently returns an empty GeoJSON collection

Example route request:

```json
{
  "origin": "University of Toronto",
  "destination": "Union Station, Toronto"
}
```

## Data Sources

- Toronto Police Service open data
- City of Toronto open data
- Regional incident sync scripts for Peel, York, Durham, and Halton
- Community report schema in `data/schema.sql`

## License

This project is proprietary and all rights are reserved. No license is granted to use, copy, modify, publish, distribute, sublicense, sell, or create derivative works from this repository or its contents.

Public visibility of the repository does not grant permission to copy or reuse the code, design, data pipeline, safety scoring logic, brand assets, documentation, or any other project material. See [LICENSE](LICENSE) for the full terms.

## Author

Built by Seyedborna Boyafraz for TKS Moonshot 2026.
