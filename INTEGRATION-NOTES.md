# Integrating the v3 Design Layer into the Components

`src/mc-interactions.css` is already imported via `src/index.css`, so every class below is live — this is a checklist of where to apply them. Each change is a `className` addition, no logic changes. Apply, run the dev server, eyeball, commit.

Reference for how each pattern should look/behave: open `mustercommand-v3.html` in a browser.

---

## 1. OccupantMobile.tsx — the check-in moment

**Primary "I'M SAFE" / check-in button** → add `mc-cta mc-cta-safe`
The shimmer sweep + 72px touch target. Crisis-UX rule: the one action that matters must be unmissable and tappable while moving.

**Status confirmation (after check-in)** → wrap the checkmark/confirmation icon in `mc-pop`
Spring pop-in makes the confirmation feel definitive — users stop re-tapping.

**Active route step / current instruction indicator** → add `mc-pulse-blue`
The pulsing halo says "this is what you do right now."

**Directive banner** → conditionally `mc-banner-drill` vs `mc-banner-live`
The app already tags DRILL vs REAL in `data.ts` / `recordStore.ts` — drive the class off that flag:
```tsx
<div className={isDrill ? "mc-banner-drill" : "mc-banner-live"}>
  {isDrill ? "PRACTICE DRILL — treat it as real." : "THIS IS NOT A DRILL."}
</div>
```

## 2. WardenTablet.tsx — roster scanning speed

**Occupant status pills** → `mc-chip mc-chip-safe` / `mc-chip-enroute` / `mc-chip-missing`
`mc-chip-missing` blinks — wardens' eyes land on exceptions first without reading.

**SOS / fall-detected rows** → add `mc-pulse-red` to the row's status dot.

## 3. FSDCommandCenter.tsx — command clarity

**Headcount accountability** → consider an SVG ring using `mc-ring-bg` / `mc-ring-fg`:
```tsx
const R = 47, C = 2 * Math.PI * R;
<svg width="114" height="114" style={{ transform: "rotate(-90deg)" }}>
  <circle className="mc-ring-bg" cx="57" cy="57" r={R} />
  <circle className="mc-ring-fg" cx="57" cy="57" r={R}
    strokeDasharray={C} strokeDashoffset={C * (1 - safeCount / total)} />
</svg>
```
One glance = percent accounted. The v3 prototype's Command tab shows the target look.

**Active F-89 directive panel** → `mc-banner-drill` / `mc-banner-live` (same flag as OccupantMobile, so occupant and command always agree on mode).

**Summary/KPI cards** → optional `mc-glass` for the frosted elevation from v3.

## 4. App.tsx — global mode visibility

The header currently shows the same chrome in drills and real events. Recommendation from the v3 audit: surface the mode in the header pill (amber "DRILL" / red "LIVE") so no screenshot, photo, or glance can confuse a drill with a real incident. `mc-banner-drill`/`mc-banner-live` on a slim strip under the header does this in one line.

---

## Order of adoption (lowest risk first)

1. Status chips (WardenTablet) — pure class swap
2. Check-in CTA (OccupantMobile) — class addition
3. Mode banners — needs the isDrill flag threaded as a prop
4. Accountability ring (FSDCommandCenter) — small new JSX block

All classes are namespaced `mc-` and additive; removing any of them reverts cleanly.
