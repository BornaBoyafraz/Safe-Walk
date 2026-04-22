Read CLAUDE.md first. Then, because prompt.MD is still a blank template, fill
it with EXACTLY the content between the --- markers below. After you've
written prompt.MD, re-read both CLAUDE.md and prompt.MD, then start working
through the "Scope for the first session" section at the bottom of prompt.MD.

Before using any API key, stop and ask me for it.

---

# Safe Walk — Source of Truth

## What it is
Safe Walk is a web app that finds SAFER walking routes in Toronto, not just
the fastest ones. A user enters a start address and a destination. Safe Walk
computes a route scored on safety (police incident density, streetlight
density, and user-submitted reports) and displays it side-by-side with the
fastest walking route on a Mapbox map.

## The problem
- 1 in 3 women in Canada report feeling unsafe walking alone at night.
- The TTC logged over 1,500 reported incidents in 2024.
- Google Maps optimizes for speed, not safety. It will happily route a
  pedestrian down a dark alley to save two minutes.
- Current workarounds (staying on the phone with a friend, taking short
  Ubers, avoiding walking altogether) are bad answers.

## Who it's for
Students at U of T / TMU / York walking home late. Healthcare workers
finishing night shifts. International students unfamiliar with Toronto at
night. Anyone who has ever changed their route because "it didn't feel
right."

## The founder
Seyedborna (Borna) Boyafraz, TKS Toronto student, solo builder. Previous
project: DebtGuard, a Claude-powered financial stress prediction platform.
Pitching Safe Walk at the TKS showcase on May 7, 2026.

## Business model (for the pitch, not the MVP)
Consumer freemium: free route planning, $2.99/mo for real-time alerts, saved
routes, share-my-walk. B2B licensing to universities at $25K–$100K ARR per
school for campus safety integration. Data licensing to insurance and
real-estate platforms long-term.

## Tech stack (matches Borna's existing style; do not change without asking)
- Backend: Node.js + Express
- Database: SQLite with better-sqlite3
- Frontend: Vanilla JavaScript + Tailwind CSS (CDN is fine for now)
- Map: Mapbox GL JS
- Routing layer: OSRM public demo server (router.project-osrm.org) for the
  fastest-route baseline, and a weighted A* over an OpenStreetMap subgraph
  (fetched once via Overpass / osmnx) for the Safe Walk route
- Geocoding: Mapbox Geocoding API
- Optional AI (later): Claude API for natural-language route summaries.
  Safe Walk is not AI-first.

## Data sources
- Toronto Police Open Data, Major Crime Indicators: https://data.torontopolice.on.ca
- City of Toronto Open Data, streetlights: https://open.toronto.ca
- OpenStreetMap for the road graph

## Code style — read carefully
Write code like a thoughtful human built it, not like a template was
generated. In practice:
- Variable and function names that read like English, not JSDoc boilerplate.
- Comments only where the WHY isn't obvious from the code. Never restate
  what the code does in a comment.
- Small focused files over one bloated route handler.
- Real error messages ("No route found between those two points — did you
  typo the address?") instead of "Error 500".
- Reasonable validation, not exhaustive. It's a demo, not a bank.
- No emojis in code, comments, or commit messages.
- Commit messages are real sentences describing what was actually done.

Still professional:
- Prettier defaults for formatting.
- No dead code or commented-out blocks.
- .env.example committed, .env never.
- A readable README in the repo root that a stranger could run from.

## Scope for the first session only
Work through these in order. Stop at the end of step 6 and show Borna the
result before moving on to the routing algorithm.

1. Initialize a Node.js + Express project with better-sqlite3 and dotenv.
   Folder layout: server/, public/, data/, scripts/. `npm start` should
   serve public/ from Express on port 3000.
2. In public/index.html, load Tailwind via CDN and render a full-window
   Mapbox map centered on downtown Toronto (43.6532, -79.3832). Confirm it
   renders before moving on.
3. Create .env.example with MAPBOX_PUBLIC_TOKEN and MAPBOX_SECRET_TOKEN. Do
   not hardcode keys. Ask me for the values when you need them.
4. Create the SQLite schema in data/schema.sql:
   - incidents (id INTEGER PK, lat REAL, lng REAL, category TEXT,
     occurred_at TEXT, source TEXT)
   - streetlights (id INTEGER PK, lat REAL, lng REAL)
   - user_reports (id INTEGER PK, lat REAL, lng REAL, category TEXT,
     note TEXT, created_at TEXT, verified INTEGER)
   Write scripts/migrate.js to apply it idempotently.
5. Write scripts/sync-incidents.js. It fetches Toronto Police MCI data from
   their open data API, handles pagination, and upserts into incidents. Hit
   the live endpoint. Do not fabricate data. Log how many rows were
   inserted.
6. Render the incidents as a Mapbox heatmap layer on the main page. This
   is the first visible milestone.

## Ground rules for this session
- Ask me for any API key when you need it.
- Commit after each numbered step with a real sentence describing what
  happened.
- If a step has taken more than 45 minutes and you aren't close, stop and
  explain what's blocking you.
- Do NOT touch routing, user reports, or the marketing landing page yet.
  Those belong to later sessions.
- When step 6 is done, tell me: (a) the localhost URL, (b) how many
  incidents were loaded, (c) what I should see on the map, (d) any
  questions before we move to the routing algorithm.