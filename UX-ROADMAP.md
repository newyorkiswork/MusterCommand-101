# MusterCommand — UX Roadmap: Floor 7 → the Whole Grid

Companion to the v3 design prototype (`mustercommand-v3.html`). Six phases; each ships value on its own and de-risks the next. North star: **every person accounted for, faster every time** — on Con Edison brand, to FDNY code, ahead of the industry on UX.

Targets at full scale: 25 floors · ~1,200 daily occupants · 100% accountability in under 5 minutes (single-floor event).

---

## Phase 0 — Floor 7 Pilot (NOW · Q3 2026, 8 weeks)

Prove the core loop with 48 real users: alarm → guided route → one-tap check-in → live command accountability.

- Drill + Live modes with distinct visual language (amber/practice vs red/NOT-A-DRILL)
- QR signage at Muster Point (offline check-in path)
- Warden roles: assist dispatch, floor sweep confirm
- Command deck: map, roster, feed, predictions
- 2 scored drills + 1 unannounced drill
- Accessibility: easy-read mode, VoiceOver, WCAG AA

**Exit criteria:** 100% accountability < 5:00 · check-in ≤ 2 taps · zero missed assist requests · SUS ≥ 80

## Phase 1 — Harden the Core (Q4 2026)

Emergencies are exactly when infrastructure fails; make it bulletproof before scaling.

- Offline-first sync — full function with zero connectivity (builds on the BLE mesh + HMAC queue already in `App.tsx`)
- Badge/SSO integration — roster auto-builds from swipes
- Visitor & contractor flow — SMS check-in, no app install
- Drill analytics — auto-generated, FDNY-ready PDF reports
- Multilingual: ES, ZH, RU, BN (NYC's top languages)
- Pen-test + failover: app works when the server doesn't

**Exit criteria:** check-in succeeds in airplane mode · 100% visitor coverage · post-drill report < 1 min

## Phase 2 — Vertical Scale: 25 Floors (Q1–Q2 2027)

Five-floor waves, two weeks each: install beacons + QR signage, train wardens, run a scored drill, advance.

- Wave rollout: F5–9 → F10–14 → F15–19 → F20–25 → F1–4
- Multi-muster assignment per floor
- Stairwell load balancing across simultaneous floors
- Command zoom: building → floor → person in two clicks
- Phased evacuation logic — fire floor + adjacent first (NYC high-rise standard)
- Warden hierarchy: floor → zone → building commander

**Exit criteria:** full-building drill, ~1,200 people, 100% accounted < 12 min · no stairwell over 80% capacity

## Phase 3 — Intelligence: the Living Building (Q3–Q4 2027)

The "4D" layer — the map that knows what's happening inside it, over time, and acts on it.

- Sensor fusion: smoke, heat, door-state feed the live map
- Digital twin — 3D building model with live occupancy
- Dynamic rerouting — hazards close routes, phones update instantly
- Congestion prediction 60–90s ahead
- Auto-drill scoring vs simulation baselines
- FDNY live data handoff — incident package in one link

**Exit criteria:** hazard-to-reroute latency < 5s · prediction accuracy ≥ 85% · FDNY package used in 1 joint exercise

## Phase 4 — Ahead of the Curve (2028)

- Watch haptics — turn cues on the wrist, phone stays pocketed
- AR wayfinding — camera arrows for visitors who don't know the building
- Mesh networking — phones relay check-ins through dead zones
- Voice-only mode — full evacuation by audio for low-vision users
- Muster kiosks — badge-tap check-in for phoneless staff
- Wellness pulse — automatic post-event check on everyone

**Exit criteria:** every occupant type covered — phone, watch, kiosk, or escort — at equal check-in speed

## Phase 5 — Platform: Beyond One Building (2028+)

4 Irving Place becomes the template; MusterCommand becomes Con Edison's emergency accountability platform.

- Multi-site: substations, service centers, generating stations
- Corporate command — every Con Ed facility on one screen
- Open API — HR, badging, BMS, city systems plug in
- Cross-agency drills with FDNY/OEM on shared live data
- Benchmark network — sites compete on drill scores
- White-label potential — the product other utilities license

**North star:** any Con Edison person, any site, accounted for in minutes — with the data to prove it improves every quarter.

---

## Design principles (from crisis-UX research)

1. **One screen, one action.** Stress narrows attention; the primary action must be unmissable and ≥72px tall.
2. **Linear steps, never maps to interpret.** Numbered sequence with the current step pulsing.
3. **Red means exactly one thing.** Reserved for live emergencies and critical status — never decoration.
4. **Drills train the real reflex.** Identical layout in drill and live modes; only tone, color, and copy shift.
5. **Celebrate practice, stay calm in reality.** Gamified drill results; informational-only live confirmations.
6. **Assume the network is down.** Every critical path needs an offline fallback (QR, mesh, kiosk).
7. **Exceptions first.** Command surfaces missing people; safe people collapse into a count.
