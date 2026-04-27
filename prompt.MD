# Safe Walk — Source of Truth

## What it is
Safe Walk is a Safety API built on top of Google Maps. It adds a "safest
route" option to any app using Google Maps. A developer calls our API with
an origin and destination, and gets back routes scored on safety — not just
speed. The safety score is computed from Toronto Police incident data,
streetlight density, community reports, and AI risk predictions.

For the demo: a Google Maps frontend with a toggle (fastest / safest) that
calls the API. The judge sees two routes on a real Google Map with scores.

## The problem
- 1 in 3 women in Canada report feeling unsafe walking alone at night.
- The TTC logged over 1,500 reported incidents in 2024.
- Google Maps optimizes for speed, not safety. It will route a pedestrian
  down a dark alley to save two minutes.
- No API exists that scores routes by safety. We're building it.

## Who it's for
Primary: developers and platforms integrating walking directions (university
campus apps, transit apps, ride-share apps).
Secondary (for the demo): end users — students, shift workers, anyone
walking alone at night in Toronto.

## The founder
Seyedborna (Borna) Boyafraz, TKS Toronto student, solo builder.
Pitching at TKS showcase May 9, 2026.

## Tech stack
- Backend: Node.js + Express
- Database: SQLite with better-sqlite3
- Frontend: Vanilla JavaScript + Tailwind CSS (CDN)
- Map: Google Maps JavaScript API
- Routing: Google Routes API (computeAlternativeRoutes for multiple paths)
- Geocoding: Google Places Autocomplete
- Safety scoring: Custom engine (incident density + streetlight density +
  time-of-day weighting)
- AI (later session): Claude API for risk prediction in data-sparse areas

## Data sources
- Toronto Police Open Data, Major Crime Indicators:
  https://data.torontopolice.on.ca (ArcGIS feature service)
- City of Toronto Open Data, streetlights: https://open.toronto.ca
- Community reports (user-submitted, stored in SQLite)

## Code style — read carefully
Write code like a thoughtful human built it, not like a template was
generated. In practice:
- Variable and function names that read like English.
- Comments only where the WHY isn't obvious from the code.
- Small focused files over one bloated route handler.
- Real error messages, not "Error 500".
- No emojis in code, comments, or commit messages.
- Commit messages are real sentences.
- Prettier defaults. .env.example committed, .env never.


## What already exists (do NOT recreate these)

- package.json — dependencies: express, better-sqlite3, dotenv
- .env.example — MAPBOX_PUBLIC_TOKEN, MAPBOX_SECRET_TOKEN, PORT
- .gitignore — node_modules, .env, *.db, .DS_Store, data/toronto-graph.json
- data/schema.sql — tables: incidents (event_id, lat, lng, category,
  offence, occurred_at, reported_at, premise_type, neighbourhood, source),
  streetlights (asset_id, lat, lng, type, wattage, status),
  user_reports (lat, lng, category, note, created_at, verified).
  Includes spatial indexes.
- scripts/migrate.js — creates safewalk.db from schema.sql
- scripts/sync-incidents.js — fetches Toronto Police MCI data via ArcGIS,
  paginates, upserts into incidents table
- server/app.js — Express server, has /api/config and /api/incidents
  (returns GeoJSON from SQLite)
- public/index.html — currently uses Mapbox (will be replaced)
- public/js/map.js — Mapbox heatmap layer (will be replaced)

Read these files to understand existing patterns before writing new code.


## Scope for this session

Read CLAUDE.md first. Then read this file. Work through these steps in
order. Before using any API key, stop and ask Borna for it.


### Step 1: Update .env.example and create .env

1. Update .env.example to:
   ```
   GOOGLE_MAPS_API_KEY=your_key_here
   PORT=3000
   ```
   Remove the old Mapbox entries.

2. Ask Borna for his Google Maps API key.

3. Create .env with the key he provides and PORT=3000.

4. Run `npm run migrate` to create the database.

5. Run `npm run sync` to fetch Toronto Police incident data. Wait for it
   to finish — it paginates through thousands of records. Log the count.

Commit: "Set up Google Maps config and run initial data sync"


### Step 2: Write the streetlight sync script

Create scripts/sync-streetlights.js that fetches streetlight data from
the City of Toronto.

The City of Toronto Open Data uses CKAN. Try this approach:
1. Hit the CKAN API to find the streetlight dataset:
   https://ckan0.cf.opendata.inter.prod-p.toronto.ca/api/3/action/package_show?id=street-lighting
2. From the response, find the resource with format "GeoJSON" or "CSV"
3. Download and parse it
4. Upsert into the streetlights table

If the CKAN approach doesn't work, try:
- Direct GeoJSON download from the dataset page
- The datastore_search API with the resource ID
- Or search for alternative endpoints

The script should:
- Extract lat, lng, and any metadata (type, wattage, status)
- Upsert using asset_id for dedup (use whatever unique ID the dataset has)
- Log how many streetlights were inserted
- Handle errors with real messages

Add npm script: "sync-lights": "node scripts/sync-streetlights.js"

Run it. Confirm the count makes sense (Toronto has ~160,000 streetlights).

Commit: "Ingest Toronto streetlight data"


### Step 3: Replace Mapbox with Google Maps

Replace public/index.html and public/js/map.js with a Google Maps version.

The new index.html should:
- Load Google Maps JavaScript API with your API key
- Load Tailwind via CDN
- Have a full-window Google Map centered on downtown Toronto (43.6532, -79.3832)
- Use a dark/night mode map style (Google Maps supports styled maps)
- Include the script tag for map.js

The new map.js should:
- Initialize the Google Map
- Load incidents from /api/incidents and render them as a heatmap layer
  (Google Maps has google.maps.visualization.HeatmapLayer)
- Verify the heatmap renders before moving on

Update server/app.js:
- Remove the old /api/config endpoint (no longer need to serve Mapbox token)
- Keep /api/incidents as-is (returns GeoJSON, the frontend converts it)

Test: open http://localhost:3000, confirm you see a dark Google Map of
Toronto with a crime heatmap overlay.

Commit: "Switch from Mapbox to Google Maps with crime heatmap"


### Step 4: Build the safety scoring engine

Create server/safety-score.js — a module that scores any point in Toronto.

```
safetyCost(lat, lng, hour) → number between 0.0 and 1.0
  0.0 = very safe
  1.0 = very dangerous
```

Implementation:

1. Query nearby incidents within ~500m. Use bounding box on the spatial
   index (lat ± 0.0045, lng ± 0.006 at Toronto's latitude).

2. For each incident, compute a weighted contribution:
   - Distance: 1 / (1 + meters / 100). Closer = more dangerous.
   - Recency: exp(-days_old / 365). Newer = more weight.
   - Severity: Assault = 1.0, Robbery = 1.0, Sexual Violation = 1.0,
     Break and Enter = 0.5, Theft Over = 0.3, Auto Theft = 0.2.
   - Contribution = distance_weight × recency_weight × severity_weight

3. Sum contributions. Normalize: incident_score = min(sum / 5, 1.0).
   (The /5 divisor means 5 weighted-equivalent nearby incidents = max score.
   Tune this if needed.)

4. Query nearby streetlights within ~100m (lat ± 0.0009, lng ± 0.0012).
   Count them. lighting_score = max(1 - count / 5, 0).
   (5+ nearby streetlights = fully lit = 0 danger from lighting.)

5. Time-of-day weighting:
   - Night (21:00 – 05:00): incident_weight = 0.6, lighting_weight = 0.4
   - Day (07:00 – 19:00): incident_weight = 0.8, lighting_weight = 0.1
   - Transition (05-07, 19-21): linear interpolation between day/night

6. Final: safety_cost = incident_score × incident_weight + lighting_score × lighting_weight
   Clamp between 0 and 1.

Export:
- safetyCost(lat, lng, hour) — single point
- scoreRoute(points, hour) — array of {lat, lng}, returns average score
  across all points (used to score entire routes)

When run directly (node server/safety-score.js), test with known locations:
- Score Queen & Sherbourne (known rough area) at 11pm → should be high
- Score Yorkville & Bay (nice area, well-lit) at 11pm → should be lower
- Score any location at 2pm → should be lower than 11pm

Print the results so Borna can sanity-check them.

Commit: "Build safety scoring engine"


### Step 5: Build the route API with Google Routes integration

Install the google auth library if needed for API calls, or just use
fetch with the API key.

Create server/routes-api.js — handles route requests.

The Google Routes API endpoint:
POST https://routes.googleapis.com/directions/v2:computeRoutes

Headers:
- Content-Type: application/json
- X-Goog-Api-Key: <your key>
- X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs

Body for walking directions with alternatives:
```json
{
  "origin": { "address": "origin address" },
  "destination": { "address": "destination address" },
  "travelMode": "WALK",
  "computeAlternativeRoutes": true
}
```

The response returns up to 3 routes. Each has an encodedPolyline.

You need a polyline decoder. Write a simple one or use the @googlemaps/polyline-codec
package (npm install it). Decoding gives you an array of [lat, lng] points
along the route.

The route scoring logic:
1. Call Google Routes API with computeAlternativeRoutes: true
2. For each returned route:
   a. Decode the polyline to get lat/lng points
   b. Sample every Nth point (every 5th or 10th) to avoid scoring
      hundreds of points — performance matters
   c. Call scoreRoute(sampled_points, current_hour) from safety-score.js
   d. Attach the safety score to the route object
3. Sort routes by safety score (lowest = safest)
4. Return them all with scores, marking which is "fastest" (default)
   and which is "safest" (lowest safety_cost)

Add to server/app.js:

POST /api/route
Body: { origin: "address string", destination: "address string" }
Response: {
  fastest: { polyline, distance, duration, safety_score },
  safest: { polyline, distance, duration, safety_score },
  all_routes: [ ... ]
}

If Google returns only 1 route (it sometimes does for short distances),
return that single route as both fastest and safest.

Test with curl or Postman:
```
POST http://localhost:3000/api/route
{ "origin": "Robarts Library, Toronto", "destination": "100 Harbord St, Toronto" }
```

Confirm you get back routes with different safety scores. Print the
scores for each route so Borna can see the difference.

Commit: "Integrate Google Routes API with safety scoring"


### Step 6: Add streetlight API endpoint

Add GET /api/streetlights to server/app.js that returns streetlight
positions as GeoJSON (same pattern as /api/incidents). Limit to a
bounding box query parameter to avoid returning all 160K at once:

GET /api/streetlights?minLat=43.64&maxLat=43.67&minLng=-79.41&maxLng=-79.37

This will be used by the frontend tomorrow to show streetlights on
the map when zoomed in.

Commit: "Add streetlights API endpoint with bounding box filter"


## Ground rules
- Ask Borna for any API key when you need it. Do not hardcode keys.
- Commit after each step with the commit message specified.
- If a step takes more than 45 minutes, stop and explain what's blocking.
- Do NOT build the frontend toggle UI, community reports form, AI
  predictions, or marketing pages. Those are later sessions.
- Match existing code patterns (error handling, DB access, file structure).
- When done, tell Borna:
  (a) How many incidents and streetlights are in the database
  (b) What the Google Maps heatmap looks like
  (c) Safety scores for the test locations (Queen/Sherbourne vs Yorkville)
  (d) The route comparison output (fastest vs safest scores for the test)
  (e) Any issues or questions before tomorrow's frontend session
