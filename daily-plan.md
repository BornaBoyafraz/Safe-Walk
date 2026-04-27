# Safe Walk — Daily Plan (Starting April 27)

## Architecture

Safe Walk is a **Safety API that sits on top of Google Maps**. Any
developer using Google Maps can plug in Safe Walk and get a "safest
route" option.

How it works:
1. Client sends origin + destination + mode ("fastest" or "safest")
2. "fastest" → proxy to Google Routes API, return the result
3. "safest" → request 3 alternative routes from Google, score each one
   using the safety graph (police data, streetlight data, community
   reports, AI risk predictions), return the safest
4. Standalone endpoint: any lat/lng/time → safety score (0-1)

For the TKS demo: a Google Maps frontend with a toggle switch
(fastest / safest) that calls the API. Judge sees two routes on a
real Google Map.

## Deadlines

| Date | Deliverable |
|------|-------------|
| Sun April 26 | Master plan article — DONE |
| Fri May 3, 11:59pm | Website + working prototype + one-pager + 2+ testimonials |
| Thu May 7, 11:59pm | 3-min Loom + slide deck + manifesto video |
| Sat-Sun May 9-10 | Live pitch at Deloitte |

---

## DAY 1 — Monday April 27 (TODAY)
**Theme: Foundation — data pipeline + safety scoring + Google Maps setup**

This is the biggest build day. You need to go from what exists (Mapbox
map + empty database) to a working safety scoring engine on Google Maps.

Claude Code session (prompt.MD):
1. Switch frontend from Mapbox to Google Maps JavaScript API
2. Set up Google Maps API key in .env (ask Borna for it)
3. Run migrate + sync to get Toronto Police data into SQLite
4. Write and run streetlight data ingest script
5. Build the safety scoring engine (server/safety-score.js):
   lat/lng/time → danger score 0-1
6. Build core API endpoints:
   - POST /api/route (origin, destination, mode)
   - GET /api/safety-score (lat, lng, time)
7. Integrate Google Routes API:
   - "fastest" → call Google, return default route
   - "safest" → get alternatives, score them, return safest

You (parallel):
- Get a Google Maps Platform API key (need Maps JavaScript API +
  Routes API enabled). Billing required but $200/month free credit
  covers everything.
- Send testimonial outreach DMs if you haven't yet

End of day goal: POST /api/route returns two differently-scored
routes for real Toronto addresses.

---

## DAY 2 — Tuesday April 28
**Theme: The demo frontend — this is what judges see**

Claude Code session:
1. Build the Google Maps frontend:
   - Two input fields with Google Places Autocomplete
   - Toggle: "Fastest" / "Safest"
   - "Find Route" button
   - Route drawn on the map (green for safe, gray for fast)
   - Info panel showing: walk time, distance, safety score
   - Option to show both routes simultaneously for comparison
2. Style with Tailwind — clean, professional, dark theme
3. Add a heatmap toggle that overlays crime density on the map
   (reuse the incident data, now on Google Maps heatmap layer)

End of day goal: The working demo. Enter two Toronto addresses,
toggle between fastest and safest, see both routes on the map
with scores. This is the pitch demo.

---

## DAY 3 — Wednesday April 29
**Theme: AI layer + community reports + polish**

Claude Code session:
1. AI risk prediction:
   - Use Claude API to analyze incident patterns and predict risk
     for areas with sparse data
   - Feed: nearby incidents, time of day, day of week, location
     type, lighting density → predicted risk score
   - Add as a weighted factor in safety scoring
2. Community reports:
   - POST /api/reports endpoint
   - Quick form: tap map location, select category (harassment,
     poor lighting, suspicious activity, other), optional note
   - Reports feed into safety scoring at lower weight
3. Polish the demo:
   - Loading states, error handling, mobile responsive
   - Make the route comparison visually clear
   - Add "Share my walk" placeholder (for pitch, doesn't need
     to be functional)

End of day goal: AI + community reports working. Demo polished
and ready to screenshot for the website.

---

## DAY 4 — Thursday April 30
**Theme: Website — day 1**

Build the marketing website. Use Framer, Lovable, v0, or similar.
Must look like SpaceX/Superhuman level, not a school project.

Pages:
- Landing page: hero (the problem + your solution), how it works
  (visual), prototype screenshots, testimonials section, CTA
- About page: your story as founder, mission, the 10X vision,
  company values
- How It Works / Technical page: the safety graph explained,
  data sources, API architecture, accuracy approach
- For Partners page: universities, transit agencies, navigation
  platforms. How to integrate. Pricing tiers.

Use screenshots from the working prototype. Repurpose copy from
the master plan article.

End of day goal: Landing page + About page live.

---

## DAY 5 — Friday May 1
**Theme: Website — day 2 + one-pager**

- Finish How It Works and For Partners pages
- Build the one-pager (PDF):
  Problem | Solution | Market ($4.2B personal safety market) |
  Business model | Traction (prototype, testimonials, data) |
  Team | Contact
  One page. Clean. No clutter.
- Lock down testimonials — final follow-ups. Need 2+ confirmed
  with real names and quotes.

End of day goal: Full website live. One-pager done.

---

## DAY 6 — Saturday May 2
**Theme: Testimonials + final polish**

- Add testimonials to the website (real quotes, real names)
- Test the prototype demo flow end-to-end 10 times. Make it
  bulletproof for the recording and live demo.
- Fix any mobile issues on the website
- Buffer for anything that slipped this week

End of day goal: All Week 2 deliverables ready to submit.

---

## DAY 7 — Sunday May 3 (WEEK 2 DEADLINE — 11:59pm)
**Theme: Submit + start pitch prep**

Morning:
- Final review of everything
- Submit: website URL, working prototype URL, one-pager PDF,
  testimonials

Afternoon:
- Start the pitch deck. Outline the 3-minute structure:
  1. Hook (story of someone walking home unsafe)
  2. The problem at scale (1 in 3 women, 1500 TTC incidents)
  3. Why Google Maps fails this (optimizes speed, ignores safety)
  4. Safe Walk: the Safety API (what it does)
  5. Demo (toggle fastest vs safest, show the map)
  6. Technical depth (safety graph + Google Routes + AI scoring)
  7. Why now (open data mandates, walking boom, institutional need)
  8. Business model (API licensing + consumer + B2B)
  9. Market + exits (Citizen $280M, Waze $1.1B, Noonlight $100M+)
  10. The 10X vision (safety layer for all urban navigation)
  11. The ask (join me — recruiting first 5 employees)

End of day goal: Week 2 submitted. Pitch deck outlined.

---

## DAY 8 — Monday May 4
**Theme: Build the pitch deck**

- Build slides (Google Slides, Figma, or Keynote)
- Minimal text. Visuals: prototype screenshots, architecture
  diagram, market size graphic, the two-route comparison
- Do a rough timed run-through. 3 minutes is short — cut anything
  that doesn't earn its time.

End of day goal: Complete slide deck.

---

## DAY 9 — Tuesday May 5
**Theme: Record the Loom**

- Rehearse the presentation 5+ times from memory
- Record the 3-minute Loom video (talk over slides, screen-share
  the live demo during the demo section)
- Multiple takes. Pick the best one.
- Write the manifesto video script (1-2 min):
  Open with the problem (woman walking alone at night, checking
  over her shoulder). Build to the vision (a world where every
  route is a safe route). End with conviction.

End of day goal: Loom done. Manifesto script done.

---

## DAY 10 — Wednesday May 6
**Theme: Manifesto video + final polish**

- Record the manifesto video. Options:
  - Phone + good lighting + quiet room (you talking to camera)
  - AI tools (Runway, CapCut) for b-roll: Toronto streets at
    night, the app on a phone screen, data visualizations
  - Or a hybrid: you on camera + b-roll cuts
- Edit it tight. Every second counts in 1-2 minutes.
- Final polish on all deliverables. Watch the Loom again. Check
  the deck. Review the website one more time.

End of day goal: Manifesto video done. Everything polished.

---

## DAY 11 — Thursday May 7 (FINAL DEADLINE — 11:59pm EST)
**Theme: Submit everything + rehearse for live pitch**

Morning:
- Upload everything to Google Drive folder:
  - Slide deck
  - 3-minute Loom video
  - Manifesto video
  - Website URL
  - One-pager PDF
- Submit before noon. Don't wait until 11:59pm.

Afternoon + evening:
- Rehearse the live pitch. You're presenting at Deloitte in 2 days.
- Practice without slides visible — you need to know the flow cold
- Prep for judge Q&A:
  - "Google could just add this." → "Google optimizes for speed and
    ads. Safety scoring requires municipal data partnerships and
    community trust they can't buy. Same reason they bought Waze
    instead of building it."
  - "How accurate is the safety scoring?" → "We validate against
    known high-incident areas. Our scoring correlates with Toronto
    Police's own heat maps at X%. We're transparent about
    limitations — we show a score, not a guarantee."
  - "What's the liability?" → "We recommend routes, we don't
    guarantee safety. Same legal framing as Waze recommending a
    faster route — they're not liable if you hit traffic."
  - "Why would universities pay?" → "They already spend $500K+/year
    on campus safety. Blue light phones cost $15K each to install.
    We give every student a safety-optimized route for a fraction
    of that cost."

End of day goal: Everything submitted. Pitch rehearsed 5+ times.

---

## DAY 12 — Friday May 8
**Theme: Final rehearsal**

- 5+ full run-throughs from memory
- Time yourself every time (must be under 3 min)
- Practice with someone if possible — parents, friends, TKS peers
- Practice the Q&A answers out loud
- Evening: rest. Get sleep. You present tomorrow.

---

## DAY 13 — Saturday May 9 (PRESENTATION DAY)
**Theme: Deliver at Deloitte**

- Morning: one final run-through. Then stop.
- Arrive early.
- 3 minutes. Tell the story. Show the tech. Paint the vision.
  Make them want to join you.

---

## Critical path (what breaks the project if it slips)

1. **Today (April 27): Safety scoring + Google Routes integration.**
   If this doesn't work, there's no demo. Everything depends on it.
2. **April 28: The frontend demo.** This is what judges see and what
   goes in the Loom video. Must be visually compelling.
3. **Testimonials by May 2.** People are slow. Follow up aggressively.
4. **The Loom recording (May 5).** You need a working demo to record
   it. If the demo isn't ready, the Loom isn't possible.
5. **Live pitch rehearsal.** You cannot wing 3 minutes at Deloitte.
   Start rehearsing May 4 at the latest.
