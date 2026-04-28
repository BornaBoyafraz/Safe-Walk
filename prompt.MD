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

Marketing website (exists — must be completely redesigned this session):
- website/index.html — landing page
- website/about.html — founder/mission page
- website/how-it-works.html — technical deep dive
- website/partners.html — partnership tiers and use cases

The API key is currently hardcoded in public/index.html as a placeholder.
That is NOT part of this session.


## Scope for this session — Redesign the marketing website

The 4 pages in website/ currently work and have decent copy, but they look
like a generic AI-generated template. For the Deloitte pitch, this website
needs to look like a real funded startup built it. Think Linear.app,
Vercel.com, Stripe.com, or Raycast.com level design quality.

Read CLAUDE.md first. Then read this file. Then read ALL FOUR existing
website pages to understand the current copy and structure. Preserve the
content and messaging — redesign the visual execution.


### Design philosophy

The goal is a website that a judge at Deloitte looks at and thinks "this
is a real company" not "a student used ChatGPT to make a website." Every
design decision should serve that goal.

**Reference sites (study these aesthetics):**
- linear.app — clean dark UI, purposeful animations, premium feel
- vercel.com — bold typography, gradient accents, developer-focused
- stripe.com — sophisticated visual hierarchy, animations that explain
- raycast.com — dark theme, 3D elements, polished interactions

**What makes a site look AI-generated (avoid ALL of these):**
- Every section is center-aligned with identical structure
- Generic 3-card grid layouts repeated everywhere
- Overuse of the brand color (green on everything)
- Cookie-cutter icon choices (lightbulb for ideas, shield for security)
- Perfectly symmetrical everything
- No visual rhythm or breathing room
- Formulaic section pattern: colored label → big heading → paragraph → cards
- Stock-feeling testimonial cards with identical layouts
- No personality or unique visual identity

**What makes a site look professional (do ALL of these):**
- Vary section layouts: some left-aligned, some split, some full-width
- Use asymmetry purposefully
- Generous but VARIED whitespace (not uniform padding on every section)
- Typography hierarchy with clear contrast between heading sizes
- Subtle grain/noise texture overlay on backgrounds for depth
- Color used sparingly and with purpose (not on everything)
- Micro-interactions that feel natural, not decorative
- Visual elements that are unique to THIS product, not generic
- Sections flow into each other instead of feeling like stacked blocks
- Code blocks that actually look good (syntax highlighting, proper fonts)


### Technical approach

Use these libraries from CDN (no build step, no npm for the website):

```
Three.js:       https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
GSAP:           https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js
ScrollTrigger:  https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js
Tailwind:       https://cdn.tailwindcss.com
Inter font:     https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap
JetBrains Mono: https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap
```

Each page is a self-contained HTML file. JS and CSS are inline (no separate
files for the marketing site). All pages share the same Tailwind config,
color palette, and nav/footer components.


### 3D animation spec (index.html hero only)

Build a Three.js scene in the hero background of the landing page. The
concept: an abstract city grid viewed from a slight angle above.

Specifically:
- Create a grid of points in 3D space (x-z plane), roughly 30x30
- Points represent intersections on an abstract map
- Most points are dim (color: #333340, small, opacity 0.3)
- Some points glow green (#34A853) — these are "safe" nodes
- Some points glow dim red (#ff4444, very subtle) — danger nodes
- Thin lines connect adjacent grid points (color: #1a1a2e, opacity 0.15)
- Animated green "pulses" travel along paths between safe nodes every
  few seconds, like data flowing through a network. Use a small glowing
  sphere or bright point that moves along a path, leaving a fading trail
- Camera: positioned above and slightly angled (not perfectly top-down),
  with a very slow orbit. Maybe 0.001 radians per frame
- Mouse interaction: subtle parallax. When mouse moves, the camera shifts
  slightly in that direction (damped, not 1:1)
- The entire scene sits behind the hero text at reduced opacity
- Performance: use THREE.Points (not individual meshes) for the grid dots.
  Use BufferGeometry. Keep draw calls low. Target 60fps on a MacBook

The 3D scene should feel like looking at a living city from above at night,
with safe routes being computed in real time. It's atmospheric, not
literal. It should make people want to watch it for a moment.

Do NOT use:
- Generic particle clouds (the "connect nearby dots" effect is overused)
- Spinning globes
- Floating geometric shapes with no meaning
- Anything that looks like a screensaver


### Scroll animations (all pages)

Use GSAP ScrollTrigger for section reveal animations:
- Headings: fade up + slight translate Y (20px), stagger if multiple
- Paragraphs: fade in with 0.1s delay after their heading
- Cards/blocks: stagger in from below, 0.15s between each
- Stats/numbers: animate counting up from 0 when they scroll into view
- Use scrub: false (trigger-based, not scroll-linked)
- Ease: "power2.out" for most, "power3.out" for hero elements
- Duration: 0.8s for headings, 0.6s for other elements
- All animated elements start with opacity: 0 and are revealed by GSAP
  (set them hidden in CSS, animate to visible in JS)

Do NOT overdo it. Not every element needs to animate. Body text paragraphs
can just appear. Only headings, cards, stats, and key visual elements
should animate. If everything flies in, nothing feels special.


### Color palette

```
Background:    #08080f (slightly darker than current #0a0a0f)
Surface 1:     #111118 (cards, nav)
Surface 2:     #1a1a25 (elevated elements)
Border:        rgba(255, 255, 255, 0.06)
Text primary:  #e8e8ed
Text secondary: #8888a0
Text muted:    #555568
Brand green:   #34A853
Brand green light: #4ade80 (hover states, accents)
Accent:        #6366f1 (used very sparingly — links, special highlights)
Danger:        #ef4444 (used only in data context, never decorative)
Code bg:       #0c0c14
```

Use the green sparingly. It should feel like an accent that draws the eye
to specific things (CTAs, active nav, key stats), not a color that's
painted on everything.


### Step-by-step instructions


#### Step 1: Redesign index.html (landing page)

This is the most important page. A judge will spend 10 seconds here and
decide if this looks like a real company or a school project.

**Nav:**
- Fixed, glass-morphism (backdrop-blur-xl, bg surface/60% opacity)
- Logo "Safe Walk" on the left — clean, no icon, just bold text
- Links: How It Works, About, For Partners
- CTA button: "Try the Demo" — subtle green border, not a filled button
- On scroll, nav gets a subtle bottom border (1px, border color)
- Mobile: hamburger menu that slides in from right

**Hero:**
- Three.js canvas takes full viewport height behind everything
- Content is centered vertically in the viewport
- Small label above headline: "Safety API for Google Maps" in green,
  uppercase, letter-spaced, small
- Headline: "Every map shows the fastest route. None show the safest."
  White, bold, large (text-6xl on desktop). The second sentence should
  have a gradient treatment (green to light green) — but make it subtle,
  not a rainbow
- Subheadline: Keep the current copy but make it text-lg, max-w-2xl,
  text-secondary color, relaxed leading
- Two buttons: "Try the Demo" (filled green, rounded-lg) and
  "How It Works" (ghost/outline, white text)
- Below the buttons, a subtle scroll indicator (thin line or chevron
  that gently bobs)

**Stats section:**
- NOT the current boxed layout with left green borders
- Instead: full-width, three stats in a row, separated by thin vertical
  dividers (1px, border color)
- Each stat: large number (text-5xl, white, font-bold) with animated
  count-up, label below in secondary text, source in muted text below that
- The stats: "1 in 3" (women feel unsafe), "1,500+" (TTC incidents),
  "0" (nav apps with safety routing)
- On scroll into view, numbers count up from 0 (GSAP)

**Problem section:**
- Left-aligned, max-w-3xl
- Green label, then heading, then paragraphs
- Keep the current copy — it's good
- Add a subtle visual element on the right side: maybe a faded/ghosted
  screenshot of Google Maps with a single blue route line, implying
  "this is all you get today." Don't actually embed a screenshot — create
  an abstract representation: a dark card with a simplified map grid and
  a single blue dotted line. CSS-only, no image files

**Solution section:**
- Different layout from the problem section — full width dark surface bg
- Heading and intro text left-aligned
- Three steps: but NOT identical cards in a row. Instead, use a vertical
  timeline-style layout or staggered layout where each step alternates
  left/right or has different visual treatment
- Step 1 (Enter route): show an abstract input field illustration
- Step 2 (Score paths): show an abstract visualization — lines being scored
- Step 3 (See safest): show the toggle concept
- These can be simple CSS illustrations, not images. Rectangles, lines,
  and dots arranged to suggest the concept

**Data sources section:**
- Keep the three colored dots + descriptions layout but improve it
- Instead of tiny dots, use small colored bars on the left (2px wide, 40px tall)
- Better spacing and typography
- Maybe add very subtle colored glow behind each source's colored bar

**Testimonials section:**
- The testimonials currently say "Testimonial Pending" — keep them but
  make the section look intentional, like an early-stage company that's
  actively collecting feedback
- Instead of "Testimonial Pending" as the name, use "Early beta tester"
  or similar
- Two cards, slightly different sizes (one wider than the other)
- Subtle quote marks or italic styling to differentiate quotes from
  regular text
- Keep the note at the bottom: "Testimonials being collected from beta
  testers."

**API preview section:**
- Keep the code block but make it look professional
- Use JetBrains Mono for the code font
- Add syntax highlighting with colors (strings in green, keys in white,
  numbers in cyan, comments in muted text)
- The code block should have a top bar like a terminal (three dots or
  a filename tab)
- Subtle glow/shadow around the code block

**CTA section:**
- "Walking home shouldn't require courage" — powerful line, keep it
- Two buttons same as hero
- Maybe add a subtle gradient or glow behind this section to make it
  feel like a crescendo

**Footer:**
- Clean, minimal
- Logo left, links center, credits right
- Data source credits
- Very thin top border

Commit: "Redesign landing page with Three.js hero and scroll animations"


#### Step 2: Redesign how-it-works.html

This page explains the technical depth. Judges and partners will read this.

**Hero:**
- No Three.js on this page (only landing page gets the 3D scene)
- Instead, use a subtle animated gradient background that shifts slowly
  (CSS animation on a background gradient)
- Same pattern: label, headline, subheadline

**Architecture section:**
- Keep the copy
- Add an animated flow diagram using CSS/SVG: show the data flow from
  "Google Routes API" → "Polyline decode" → "Safety scoring" → "Ranked
  routes returned." Use connected boxes with animated dashed lines between
  them. GSAP can animate the line dash offset to show data flowing

**Safety scoring section:**
- This is the most important section on this page
- Keep all the formulas and explanations
- But present them in styled code/formula blocks with proper formatting
- Each of the three signals (incident density, streetlight coverage,
  time-of-day) should have its own distinct visual treatment
- For incident density: show the distance weight, recency weight, severity
  weight formulas in separate styled blocks
- Color-code the formula components: variable names in cyan, operators
  in white, descriptions in muted text
- Maybe add a small visual for each: a declining curve for distance decay,
  a clock for time-of-day

**Final score section:**
- Show the master formula prominently, almost like a hero element
- Green for the safety_cost label
- Day vs night weights shown as a toggle or side-by-side comparison

**Data sources section:**
- Similar treatment to landing page but more detailed
- Each source gets a full card with description

**API reference section:**
- Two endpoints, styled like real API docs (think Stripe API docs)
- Endpoint path in a header bar
- Request/response in separate code blocks with syntax highlighting
- Maybe a tab interface: Request | Response

**What's next section:**
- Keep the copy about AI prediction layer and university partnerships

Commit: "Redesign how-it-works page with flow diagrams and styled formulas"


#### Step 3: Redesign about.html

This page tells the founder story. It should feel personal and authentic.

**Hero:**
- No 3D. Subtle gradient or solid dark background
- The headline is great: "Built because the walk home shouldn't be the
  most dangerous part of your night" — keep it

**Founder section:**
- This should NOT look like a generic "about the team" section
- Left-aligned, generous line height, comfortable reading width (max-w-2xl)
- The text is personal and good — let it breathe with great typography
- Maybe a subtle pull quote highlighted from the text: "Is the shortcut
  worth the risk?" in a larger, slightly styled format inline

**Mission section:**
- Keep the copy
- Add a subtle background element: abstract map lines or a grid pattern
  at very low opacity

**10X vision section:**
- This section is important for TKS judges
- Make "going from zero to something" feel impactful visually
- Maybe show a before/after: "0 safety signals" on the left, big arrow,
  "thousands per route" on the right. Simple, typographic treatment

**Values section:**
- Four values. Don't use the typical icon-card grid
- Instead: vertical list, each value is a row with the title on the left
  and description on the right, separated by a thin line
- Clean, editorial layout (like a manifesto page)

**Contact section:**
- Email link. Clean and simple. Maybe a large email address that's also
  a mailto: link

Commit: "Redesign about page with editorial layout"


#### Step 4: Redesign partners.html

This page needs to convince potential partners. Professional and business-
oriented.

**Hero:**
- Clean and direct: "Add safety-aware routing to your platform"

**Use cases section:**
- Three use cases: universities, transit, nav platforms
- Don't use identical cards. Use a larger featured card for one (maybe
  universities since that's the immediate target) and two smaller ones
- Or use a tab/accordion interface where clicking a use case expands
  its details

**Why partner section:**
- Four reasons. Use a numbered list style (large numbers 01, 02, 03, 04)
  with descriptions to the right. Think design-agency-style layout
- Not cards. Horizontal rows with numbers as the visual anchor

**Pricing section:**
- Three tiers. This one CAN use cards since pricing tiers are expected
  in card format
- But differentiate them: the featured tier (Institution) should be taller
  or have a distinct visual treatment (subtle green border, slight
  elevation)
- Price numbers should be bold and large
- Features listed cleanly below each price

**CTA section:**
- "Ready to make your platform safer?"
- Single email CTA, clean

Commit: "Redesign partners page with professional business layout"


#### Step 5: Cross-page consistency and polish

Review all four pages together:

1. Nav and footer are identical across all pages (copy-paste the exact
   same markup). Active page should be highlighted in the nav (white text
   instead of gray)

2. All internal links work correctly:
   - Logo links to /website/index.html on all pages
   - Nav links use /website/ prefix on all pages
   - Footer links match nav links

3. "Try the Demo" buttons link to "#" for now (placeholder)

4. Email links use mailto:bornaboyafraz@gmail.com

5. Test at different viewport widths. Pages should look good at:
   - Desktop: 1440px (primary target)
   - Laptop: 1024px
   - Tablet: 768px (should still be usable, doesn't need to be perfect)
   - Mobile: 375px (nav collapses, content stacks, still readable)

6. Three.js performance: the 3D scene on the landing page should not
   cause frame drops. If it does, reduce point count or simplify

7. Check that GSAP animations don't cause layout shift (elements should
   be positioned before animation, just invisible)

8. All code blocks use JetBrains Mono

9. No console errors on any page

10. Page titles are descriptive:
    - "Safe Walk — The Safety Layer for Urban Navigation"
    - "How It Works — Safe Walk"
    - "About — Safe Walk"
    - "For Partners — Safe Walk"

Commit: "Ensure cross-page consistency and responsive layout"


## Ground rules
- Read CLAUDE.md first.
- Read all four existing website files before making any changes — preserve
  the copy and messaging, redesign the visuals.
- Commit after each step with the commit message specified.
- Do NOT touch anything outside the website/ folder in this session.
- Do NOT build the demo frontend, API endpoints, or any backend code.
- Every page must work as a standalone HTML file opened in a browser
  (all assets from CDN, no local dependencies, no build step).
- The website should look like it was built by a design-focused startup,
  not generated by AI. When in doubt, look at how linear.app does it.
- When done, tell Borna which pages were updated and any issues found.
