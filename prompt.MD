# Safe Walk — Source of Truth

## What it is
Safe Walk is a Safety API built on top of Google Maps. It adds a "safest
route" option to any app using Google Maps routing. The API scores walking
routes using police incident density, streetlight coverage, community
reports, and AI risk predictions. A demo frontend shows a toggle between
"fastest" and "safest" routes on a Google Map.

TKS Moonshot. Pitch at Deloitte, May 9-10, 2026. All deliverables due May 7.

## Tech stack
- Backend: Node.js + Express
- Database: SQLite via better-sqlite3
- Frontend: Vanilla JS + Tailwind CSS (CDN)
- Maps: Google Maps JavaScript API
- Routing: Google Routes API (computeAlternativeRoutes)
- Geocoding: Google Places Autocomplete
- Safety scoring: Custom engine in server/safety-score.js

## Code style
- Names that read like English. Comments only for non-obvious WHY.
- Small focused files. Real, specific error messages.
- No emojis anywhere. Commit messages are real sentences.
- Prettier defaults. .env.example committed, .env never.


## What already exists (do NOT recreate these — read them first)

Backend (fully working):
- server/app.js — Express server with:
  - GET /api/incidents → returns all incidents as GeoJSON
  - GET /api/streetlights?minLat&maxLat&minLng&maxLng → returns
    streetlights in bounding box as GeoJSON
  - POST /api/route { origin, destination } → returns { fastest, safest,
    all_routes } where each route has: polyline (encoded), distanceMeters,
    duration (string like "900s"), safety_score (0-1, lower = safer)
- server/safety-score.js — safetyCost(lat, lng, hour) and scoreRoute(points, hour)
- server/routes-api.js — calls Google Routes API, decodes polylines,
  scores each route, returns fastest and safest

Data pipeline (working):
- data/schema.sql — incidents, streetlights, user_reports tables
- scripts/migrate.js, sync-incidents.js, sync-streetlights.js
- data/safewalk.db — populated with real Toronto data

Frontend (basic — needs to be rebuilt this session):
- public/index.html — loads Google Maps API with hardcoded key (needs fix),
  has a full-window dark map
- public/js/map.js — initializes Google Map with dark theme and loads a
  crime heatmap from /api/incidents

The API key is currently hardcoded in index.html as a placeholder. It should
be loaded from the server instead.


## Scope for this session — Build the demo frontend

This is the most important visual for the entire project. When a judge or
investor sees this demo, they need to immediately understand: "Oh, you can
toggle between fastest and safest and see the actual difference on a real
Google Map." If this looks good, the pitch lands.

Read CLAUDE.md first. Then read this file. Then read the existing
public/index.html and public/js/map.js to understand what's already built.
Work through these steps in order.


### Step 1: Serve the Google Maps API key from the backend

The API key should not be hardcoded in HTML. Fix this:

1. Add a GET /api/config endpoint to server/app.js that returns:
   { googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY }

2. Update public/index.html to NOT include the Google Maps script tag
   statically. Instead, the JS will load it dynamically after fetching
   the key from /api/config.

3. In map.js, fetch /api/config first, then dynamically create the Google
   Maps script tag with the key and the Places + Visualization libraries:
   ```
   const script = document.createElement('script');
   script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=visualization,places&callback=initMap`;
   document.head.appendChild(script);
   ```

Test: page loads, map renders, no key visible in HTML source.

Commit: "Load Google Maps API key from server instead of hardcoding"


### Step 2: Build the route input UI

Replace the current bare map with a proper layout. The page should have:

LEFT SIDEBAR (fixed width ~380px, dark background #1a1a2e or similar):
- Safe Walk logo/title at the top (text is fine, no image needed)
- "From" input field with Google Places Autocomplete
- "To" input field with Google Places Autocomplete
- A prominent "Find Route" button
- Below the button, a route mode selector:
  Two buttons/tabs side by side: "Fastest" and "Safest"
  Default to "Safest" selected
  When clicked, switches which route is highlighted on the map
- Route info panel (hidden until a route is computed):
  Shows for the selected mode:
  - Walk time (convert duration string "900s" to "15 min")
  - Distance (convert meters to km, one decimal)
  - Safety score (display as a percentage: (1 - score) * 100, so
    lower danger = higher safety %. Show as "Safety: 78%" with a
    colored bar: green > 70%, yellow 40-70%, red < 40%)
  - A small text comparing: "This route is X min longer but Y% safer
    than the fastest route" (only show when viewing the safest route)

RIGHT SIDE (remaining width):
- The Google Map, full height
- Keep the dark map style from the current map.js

Style everything with Tailwind. The design should feel like a real product:
clean, dark theme, professional. Think Google Maps meets a premium dashboard.
Not a school project. No rounded-corner cards floating over the map. The
sidebar is a solid panel.

Commit: "Build route input sidebar with Places Autocomplete"


### Step 3: Draw routes on the map

When the user clicks "Find Route":

1. Call POST /api/route with the origin and destination addresses from
   the autocomplete inputs.

2. Decode both polylines (fastest and safest) on the frontend. Use the
   same decoding function as routes-api.js, or copy it into map.js.

3. Draw BOTH routes on the map simultaneously:
   - The non-selected route: thin line (3px), gray (#666666), opacity 0.4
   - The selected route: thicker line (6px), colored by mode:
     - Fastest: blue (#4285F4, Google blue)
     - Safest: green (#34A853, Google green)
   - Use google.maps.Polyline for each

4. Fit the map bounds to show the entire route (use map.fitBounds with
   a LatLngBounds that contains all points of both routes).

5. Add markers at origin and destination. Simple default markers are fine.

6. When the user clicks "Fastest" or "Safest" tabs, swap which route is
   highlighted (thick + colored) vs dimmed (thin + gray). Update the
   info panel to show that route's stats. Don't re-fetch — just toggle
   the display.

7. If the user searches a new route, clear the old polylines and markers
   before drawing new ones.

Test: Enter "Robarts Library, Toronto" → "100 Harbord St, Toronto".
You should see two different routes on the map, one green (safest) and
one faintly visible in gray. Switching to "Fastest" should highlight the
other route in blue.

Commit: "Draw fastest and safest routes with toggle switching"


### Step 4: Add the heatmap as a toggleable layer

The crime heatmap from map.js is useful context but shouldn't be on by
default (it clutters the route view). Add it as an optional overlay:

1. Add a small toggle button in the sidebar or on the map (like Google
   Maps' layer controls): "Show Crime Heatmap" checkbox or toggle.

2. When enabled, load /api/incidents and render the heatmap (use the
   existing heatmap code from map.js).

3. When disabled, remove the heatmap layer.

4. Default: OFF (the route comparison should be the first thing people see,
   not a scary red map).

Commit: "Add toggleable crime heatmap overlay"


### Step 5: Add streetlight layer at high zoom

When the map is zoomed to level 15 or higher, load and show nearby
streetlights as small dots:

1. Listen to the map's 'idle' event (fires after pan/zoom stops).

2. If zoom >= 15, get the current map bounds and fetch
   /api/streetlights?minLat=...&maxLat=...&minLng=...&maxLng=...

3. Render streetlights as small circles:
   - Radius: 4px
   - Color: light cyan (#00E5FF) or similar cool tone
   - Opacity: 0.3
   - Use google.maps.Circle or google.maps.Marker with a custom icon

4. Clear old streetlight markers when the view changes and re-fetch.

5. If zoom < 15, remove all streetlight markers.

This gives the judge a powerful zoom-in experience: they see the route,
zoom into a specific block, and see "oh, this stretch has no streetlights
and is right next to a crime cluster — that's why the safe route avoids it."

Commit: "Show streetlight dots when zoomed in"


### Step 6: Polish and edge cases

1. Loading state: show a spinner or "Finding your safe route..." text
   in the info panel while the API call is in progress. Disable the
   button.

2. Error handling: if /api/route returns an error, show it in the info
   panel as a readable message (not a JSON blob or console error).

3. Empty state: before any route is searched, show a brief message in
   the info panel: "Enter a start and destination to find your safest
   walking route."

4. Mobile: the sidebar should collapse to the bottom on small screens
   (or just make sure it doesn't break — full mobile responsiveness
   isn't required for the demo, but it shouldn't look terrible).

5. The page title should be "Safe Walk — Find Your Safest Route".

6. Add a small footer in the sidebar: "Data: Toronto Police Open Data,
   City of Toronto" — credits the data sources.

Test the full flow end to end:
- Open the page → see the map with an empty sidebar
- Type addresses with autocomplete suggestions
- Click Find Route → see loading → see both routes drawn
- Toggle between Fastest and Safest → routes swap highlighting
- Check the info panel stats → make sense
- Toggle the heatmap on → see crime overlay
- Zoom in → see streetlight dots
- Search a new route → old one clears, new one appears

Commit: "Polish UI with loading states and error handling"


## Ground rules
- Ask Borna for any API key if you need a new one.
- Commit after each step with the commit message specified.
- If a step takes more than 45 minutes, stop and explain what's blocking.
- Do NOT build community reports, AI predictions, or the marketing website.
  Those are separate sessions.
- The frontend should feel like a real product. Dark theme, clean layout,
  professional typography. This is what judges see.
- When done, tell Borna:
  (a) The localhost URL to open
  (b) What the demo flow looks like
  (c) Any issues with the Google Maps API or route scoring
  (d) What's next (AI layer + community reports)
