# PRD — Statistics Cockpit (Statistik-Tab Redesign)

> Companion to `PRD.md` (wire/store contract is unchanged) and `PRD-design-overhaul.md` (Telemetric-Cockpit DS is locked). This PRD scopes the **Statistik tab** redesign on Desktop, Tablet, and Mobile, the new derive helpers, the Recharts visualisations, and the wire-up to the existing `useLiveStore` and `useFilterStore`. Stitch references for the visual concept are documented in §3 and live in project `projects/13661023061589856813`.

---

## Problem Statement

As a motorsport fan and analyst opening the **Statistik** tab during the ADAC 24h Nürburgring, I see three plain HTML tables (`LEADING`, `BESTLAPS`, `BESTSECTORS`) rendered straight from the PID 9002 payload — no filter, no hierarchy, no visual cue, no clickable hand-off into a car drilldown. During a real session there are ~125 leading rows, ~154 best-lap rows and **~1356 best-sector rows** in store memory, so the tab is in practice unreadable on every device. Mobile gets the desktop layout in one column with horizontal scroll only on the Class column, which makes the tab an immediate pain point on phones.

Reference: current state on event 50 / config w3 — see `docs/screenshots/current-stats-tab-desktop.png` and `docs/screenshots/current-stats-tab-mobile.png`.

## Solution

Replace `<StatisticsPanel>` with a **Statistics Cockpit**: a four-band layout that surfaces fastest-lap KPIs, theoretical-best, an interactive class chip filter, a **horizontal Recharts bar chart of best lap per class**, a **sector heatmap matrix** (rows = class, cols = S1..S9, color = % delta to column-best), and an **enriched leading table** that joins PID 9002 NR with PID 0 RESULT to show driver/team/gap. All four bands share one `<StatsClassFilter>` chip bar, persisted via the existing `useFilterStore` pattern (new `excludedStatsClasses` slice mirroring `excludedClasses`). Mobile reflows to a 2×2 KPI grid, a horizontally scrollable heatmap with sticky class column, top-5 bars with "Mehr anzeigen", and the leading table collapses to a compact 2-line list of red-striped cards.

We reuse **Recharts 3.8** (already in the bundle) for the bar chart and any line chart variants — we do **not** introduce Chart.js. The sector heatmap is a custom CSS-grid SVG-free component since none of the libraries hit the density/colour-mapping spec well at 1356 cells.

Stitch references for the visual concept (locked DS = Telemetric Cockpit, dark, `#E30613`, Space Grotesk + Inter, JetBrains Mono numerics, `ROUND_FOUR`):

- Desktop: `projects/13661023061589856813/screens/dfe198ab03994998bc4621f13f9c0429` ("ADAC 24h NBR: Statistics Cockpit", 2560×2608) — see `docs/screenshots/stitch-stats-cockpit-desktop.png`.
- Mobile: `projects/13661023061589856813/screens/2544b52d739c4520b8fc508d184a3661` ("Statistik: ADAC 24h Nürburgring", 780×2590) — see `docs/screenshots/stitch-stats-cockpit-mobile.png`.

## User Stories

> Tracking: erledigte Stories als ~~durchgestrichener Originaltext~~ markieren, offene mit `- [ ]`.

### Statistik tab — KPI strip

1. **[offen]** As a spectator, I want to see the **schnellste Runde des Rennens** (lap time + class + #NR) as a hero KPI in the Statistik tab, so that I do not have to scan a 154-row table to find it.
2. **[offen]** As an analyst, I want a **theoretische Bestzeit TOTAL** KPI (sum of column-bests across S1..Sn from `BESTSECTORS` for `CLASS=TOTAL`), so that I can see what the fastest lap on this circuit could currently be.
3. **[offen]** As an analyst, I want a **Δ Real → Theoretisch** KPI rendered with race-green sign (positive = unused potential) so that I instantly see how much performance is left on the table.
4. **[offen]** As a spectator, I want an **Aktive Klassen** KPI (count of distinct CLASS values in `LEADING`, excluding `TOTAL`) plus the raw `LEADING` count as caption, so that I have a sense of grid scope.
5. **[offen]** As a developer, I want all KPI numbers rendered with `JetBrains Mono` and the `formatLapSeconds` helper so deltas and lap times line up across the dashboard.
6. **[offen]** As a viewer with no live event data, I want the KPI strip to render a skeleton (4 placeholder cards with em-dash values), so that the tab does not collapse to a single "No statistics" string.

### Statistik tab — class filter

7. **[offen]** As a spectator, I want a **horizontal chip bar** of all classes present in PID 9002 (deduped from `LEADING.CLASS ∪ BESTLAPS.CLASS ∪ BESTSECTORS.CLASS`), so that I can hide noise and focus on a class group.
8. **[offen]** As a returning user, I want my class selection to **persist across reloads** (URL param `statsExcludedClasses=` + same lazy-hydration pattern as `excludedClasses`), so that my view stays put when refreshing during a 24h race.
9. **[offen]** As a power user, I want a **Reset** link at the right edge of the chip bar to clear all exclusions in one click.
10. **[offen]** As a user on mobile, I want the chip bar to **horizontally scroll with a fade mask** at the right edge, so that I can still discover all classes without losing layout density.
11. **[offen]** As a developer, I want the chip bar to also drive the bar chart, the heatmap and the leading table from the **same** filtered class set, so that the four bands stay consistent.

### Statistik tab — best-lap-per-class bar chart

12. **[offen]** As an analyst, I want a **horizontal Recharts BarChart** of best lap per class (Y = class name, X = lap time in seconds), so that I can compare classes at a glance.
13. **[offen]** As a viewer, I want bars **sorted ascending by lap time** (fastest at top), so that the visual order matches "best".
14. **[offen]** As a viewer, I want the lap-time label rendered at the **end of each bar** in `JetBrains Mono`, formatted as `m:ss.SSS` via the existing `formatLapSeconds` helper.
15. **[offen]** As a viewer, I want each bar **coloured by class** using the existing `--chart-1`…`--chart-N` token rotation, with `TOTAL` always in Nürburgring red, so the overall theme stays consistent.
16. **[offen]** As a viewer, I want a **tooltip** on hover with the full set: class, #NR, lap time, day-time, and (if present in PID 0 RESULT) driver/team name from the joined row.
17. **[offen]** As a mobile user, I want the chart to render **only the top 5 bars** by default with a "Mehr anzeigen ↓" link that expands to show all classes.

### Statistik tab — sector heatmap

18. **[offen]** As an analyst, I want a **sector heatmap matrix** with rows = class and columns = `S1..Sn` (n derived dynamically via `maxSectorColumns`, no hardcoding to 9), so that the matrix shrinks/grows with the actual circuit layout.
19. **[offen]** As an analyst, I want each cell shaded **green → yellow → orange → red** by `(cell − columnBest) / columnBest`, so that weak sectors are visually obvious.
20. **[offen]** As an analyst, I want each cell to display the **absolute sector time** in mono ~10–11px and to expose a tooltip with the **delta vs. column-best** (`+0.142 s`, `+1.81 %`).
21. **[offen]** As an analyst, I want a final **LAP** column appended after S-columns showing `BESTSECTORS[i].LAPTIME`, so that I can compare class-bests in the same row.
22. **[offen]** As a mobile user, I want the matrix to **horizontally scroll with a sticky first column** (class name), so that the row label never disappears.
23. **[offen]** As a developer, I want the heatmap implemented as a **CSS grid** (no SVG), so that we keep DOM accessibility (each cell is a `<button>` with `aria-label`) and theme tokens apply directly.
24. **[offen]** As a desktop user, I want the heatmap to take **40 %** of the main band width, the bar chart **60 %**, in a 12-col grid.
25. **[offen]** As an analyst, I want a click on a heatmap cell to **scroll the leading table** to the matching class row and highlight it for 1.5 s (no drilldown if the row has no `NR`).

### Statistik tab — enriched leading table

26. **[offen]** As a spectator, I want a **Klassen-Führende** table with columns: Klasse, #, Fahrer / Team, Runden, Gap, Zeit gesamt, seit Runde, so that the leading slice of PID 9002 is immediately readable.
27. **[offen]** As a developer, I want the **driver / team** column derived by joining `LEADING.NR` with `useLiveStore.snapshot.RESULT[*].STNR` (string match on the trimmed wire value), falling back to em-dash if no row found.
28. **[offen]** As a fan, I want a click on the **#NR cell** to open the existing `<CarDrilldownDialog>` for that car number, so that I can immediately see lap-time chart and stints.
29. **[offen]** As a power user, I want the table **sortable by Klasse, Runden, Gap, Zeit gesamt** via column header click, with a single sort key at a time.
30. **[offen]** As a viewer, I want the table to inherit the **sticky header** + alternating zebra rows (`surface_container_low` / `_lowest`) defined in the design system, so density stays high.
31. **[offen]** As a mobile user, I want each row collapsed to a **2-line card with a 2 px red left stripe**: line 1 = `«Klasse» · Runde N · «Gap»` (mono), line 2 = `#«NR»  «Fahrer / Team»`, with a chevron right hinting the drilldown.

### Empty / loading / error states

32. **[offen]** As a viewer of a session **without PID 9002 yet** (Pre-session, or right after `LTS_TIMESYNC`), I want the tab to render a **skeleton with KPI placeholders, an empty chip bar, and a single "Statistik wird geladen…" line**, instead of the current "No statistics" string.
33. **[offen]** As a viewer in a `LTS_NOT_FOUND` event, I want the existing `<EventNotFoundOverlay>` to keep priority over this tab, so the cockpit redesign does not mask the connection error.
34. **[offen]** As a viewer when WebSocket is reconnecting, I want the band content to **dim to 60 % opacity** but remain visible (no flash to placeholder), so I do not lose context for the few seconds of a reconnect.

### Internationalisation

35. **[offen]** As a German-speaking spectator, I want every label (`Statistik`, `Klassen-Führende`, `Schnellste Runde`, `Beste Sektor-Splits`, …) routed through `src/i18n/strings.ts`, with `de` as primary and `en` available, so that the tab matches the rest of the dashboard.

### URL / shareability

36. **[offen]** As a Twitter/Discord poster, I want `?tab=stats` and `?statsExcludedClasses=Cup3,V6` to round-trip through the URL, so that I can deep-link a colleague to a filtered view.

### Test data & determinism

37. **[offen]** As a developer, I want a **fixture** (`src/lib/__fixtures__/pid9002.event50.json`) captured from event 50 / config w3 (date `2026-04-19`), so that the new derive helpers are unit-testable on real, representative data.

### Performance

38. **[offen]** As a developer, I want the four bands wrapped in `React.memo` and the derive helpers memoised on the `(statistics, snapshot, excludedStatsClasses)` triple, so that re-renders triggered by unrelated PID 0/3/4 frames do not retrigger heatmap layout.

### Accessibility

39. **[offen]** As a screen-reader user, I want each heatmap cell to expose `aria-label="Klasse «X», Sektor «Sn», Zeit «t», Δ «d»"`, so that the matrix is operable beyond the visual encoding.
40. **[offen]** As a keyboard user, I want chip bar, table headers, table rows, and heatmap cells reachable via Tab with visible focus rings (the existing `outline_variant` 30 % token).

---

## Implementation Decisions

### New / modified modules

- **`src/lib/statistics.ts` — pure derive (NEW, deep module).** Exposes:
  - `classKpis(stats, snapshot)` → `{ fastestLap, theoreticalBestSeconds, deltaSeconds, activeClasses, leadingCount }`.
  - `bestLapsByClass(stats, opts: { excludedClasses })` → `Array<{ className, nr, lapTimeSeconds, lapTimeLabel, daytime, driverTeam }>` sorted ascending.
  - `sectorHeatmap(stats, opts)` → `{ classes: string[], sectorCount: number, cells: number[][], absLabels: string[][], deltas: number[][] }`. The matrix is a dense 2-D array; missing values are `NaN` so the colour scale renders a transparent cell.
  - `theoreticalBestForClass(stats, className)` → `number | null`.
  - `enrichedLeading(stats, snapshot, opts)` → `Array<{ className, nr, laps, sum, fromLap, gap, driverTeam }>`.
  - All helpers take **already-validated row arrays**; they do not call `asRows` themselves. They never read from `useLiveStore`. They reuse `parseLapTimeToSeconds` / `formatLapSeconds` from `lapTimes.ts`.
- **`src/store/useFilterStore.ts` — extend.** Add `excludedStatsClasses: Set<string>`, `toggleExcludedStatsClass`, `clearExcludedStatsClasses`, `setExcludedStatsClasses`. Mirror persistence into `urlFilters.ts` via key `statsExcludedClasses=` (comma-separated).
- **`src/lib/urlFilters.ts` — extend.** Add the new key end-to-end (parse + serialise + test).
- **`src/components/stats/StatisticsCockpit.tsx` (NEW).** Composes the four bands. Renders skeleton when `useLiveStore(s => s.statistics)` is `null`.
- **`src/components/stats/StatsKpiStrip.tsx` (NEW).** 4-card row, 2×2 on `<md`. Uses `<DataNumeric>`-style cell for the value.
- **`src/components/stats/StatsClassFilter.tsx` (NEW).** Horizontal chip bar; on mobile gets `overflow-x-auto` with `mask-image: linear-gradient(...)` for the right fade. Uses `useFilterStore`.
- **`src/components/stats/BestLapPerClassChart.tsx` (NEW).** Recharts horizontal `BarChart` + custom tooltip in shadcn dark style. Top-5 + expand button on mobile.
- **`src/components/stats/SectorHeatmap.tsx` (NEW).** CSS-grid based; one DOM `<button>` per cell with `title` and `aria-label`. Sticky `position: sticky; left: 0` on the first column. No SVG.
- **`src/components/stats/LeadingTable.tsx` (NEW).** Sortable column headers; `#NR` cell is a button that opens `<CarDrilldownDialog>` via the existing dialog store. Mobile variant renders a `<ul>` of compact card rows.
- **`src/components/StatisticsPanel.tsx` — DEPRECATE / replace import sites.** `DashboardShell.tsx` and `MobileShell.tsx` switch to `<StatisticsCockpit />`. The old file is removed in the same PR.
- **`src/i18n/strings.ts` — extend.** Add `stats.kpi.*`, `stats.filter.*`, `stats.bestLap.*`, `stats.heatmap.*`, `stats.leading.*` keys for `de` and `en`.

### Architectural choices

- **No Chart.js.** Recharts 3.8 is already in the bundle and consistent with `LapTimeChart` / `LeaderDeltaChart`. Adding Chart.js would cost ~60 kB and split the chart contract.
- **Heatmap is hand-built CSS grid.** Recharts has no first-class heatmap; an SVG approach loses native scrolling, sticky columns, and DOM accessibility. CSS grid keeps a11y, sticky-col, and lets us reuse `--chart-*` tokens via `color-mix()` for the green/yellow/red ramp.
- **Driver/team join is read-only.** `enrichedLeading` builds an `STNR → row` index from PID 0 RESULT once per snapshot change; it never mutates the store. If RESULT is empty, the column shows em-dash.
- **State stays in zustand.** No new context. The only new persisted value is `excludedStatsClasses` (URL param mirrors `excludedClasses` exactly).
- **No new wire frames.** All data is in PID 9002 + PID 0 RESULT, both already streamed and stored.
- **No SSR / no server.** This stays a static frontend.

### API contract (TypeScript shapes)

- `ClassKpis = { fastestLap: { className, nr, lapTimeSeconds, lapTimeLabel } | null; theoreticalBestSeconds: number | null; deltaSeconds: number | null; activeClasses: number; leadingCount: number }`
- `BestLapRow = { className: string; nr: string; lapTimeSeconds: number; lapTimeLabel: string; daytime: string | null; driverTeam: string | null }`
- `SectorHeatmap = { classes: string[]; sectorCount: number; cells: number[][]; absLabels: string[][]; deltas: number[][]; columnBests: number[] }` — `cells[i][j]` is the relative delta `(t − colBest) / colBest`, `NaN` for missing.
- `EnrichedLeadingRow = { className: string; nr: string; laps: number | null; sum: string | null; fromLap: string | null; driverTeam: string | null; gapToBest: string | null }`

### Out-of-tree references

- Stitch desktop screen: `dfe198ab03994998bc4621f13f9c0429` (in project `13661023061589856813`). PNG checked in at `docs/screenshots/stitch-stats-cockpit-desktop.png`.
- Stitch mobile screen: `2544b52d739c4520b8fc508d184a3661`. PNG at `docs/screenshots/stitch-stats-cockpit-mobile.png`.
- Current state PNGs: `docs/screenshots/current-stats-tab-{desktop,mobile}.png`.

---

## Testing Decisions

A good test here exercises **observable behaviour**: given a captured PID 9002 fixture and a captured PID 0 RESULT fixture, the derive output matches a snapshot of expected rows; given a user click on a chip, the chart and table both filter; given a click on a heatmap cell, the leading table scrolls to that class. We do **not** test the inner Recharts DOM (private to the lib), the chip animation, or that React.memo runs.

### Modules to test

- **`src/lib/statistics.test.ts` (Vitest, NEW).** Covers `classKpis`, `bestLapsByClass`, `sectorHeatmap`, `theoreticalBestForClass`, `enrichedLeading`. Edge cases: empty PID 9002, PID 9002 without TOTAL row, sectors of mixed length per class (4 vs 6 vs 9), `LEADING.NR` not present in PID 0 RESULT, duplicate class names. Use a fixture captured from event 50 (`src/lib/__fixtures__/pid9002.event50.json` + `pid0.event50.json`).
- **`src/lib/urlFilters.test.ts` (extend existing).** Round-trip `statsExcludedClasses` through parse + serialise; assert URL is shorter than 2000 chars for the worst case (~30 classes × avg 6 chars). Covered by parameterised cases similar to existing `excludedClasses` tests.
- **`src/components/stats/StatisticsCockpit.test.tsx` (RTL, NEW).** Render with the fixture frame, assert: KPI values render in mono, chip bar shows all unique classes with `TOTAL` selected by default, clicking a chip toggles the class out of the bar chart and the table, clicking #NR triggers drilldown open. No assertions on Recharts internals — query by chart's `aria-label` / role instead.
- **`src/components/stats/SectorHeatmap.test.tsx` (RTL, NEW).** Render with a 3-class × 4-sector synthetic input; assert each cell button has the expected `aria-label`, the sticky-first-column `<th>` has `role="rowheader"`, and clicking a cell fires the `onClassActivate` callback.
- **No Playwright story for v1.** E2E for the cockpit tab is added in a follow-up once the existing Playwright `webServer` can mock a PID 9002 frame; see "Out of Scope".

### Prior art in repo

- `src/lib/lapTimes.test.ts` and `src/lib/leaderDeltaSeries.ts` — pure derive style.
- `src/lib/urlFilters.test.ts` — URL round-trip pattern.
- `src/lib/leaderboard.test.ts` — fixture-driven aggregation.

---

## Out of Scope

- Adding **Chart.js** as a second chart library (Recharts is sufficient for v1).
- A **time-series** view of how the fastest lap evolves over the session (would require keeping a history slice; PID 9002 is push-only snapshot).
- Per-driver stints / pit history inside the Statistik tab — that lives in the **Car Drilldown** dialog already.
- A separate **STQ statistics** view (PID 501 has its own tab).
- A **CSV / clipboard export** of the leading table (queue for v2).
- Playwright E2E for the cockpit (we need a fixture-injection harness on `useLiveConnection` first; tracked as a follow-up).
- Re-styling the **Track Map / Heatmap** tab (that is N4 in the design overhaul plan and stays untouched).
- A **2nd accent colour scheme** for colour-blind users — added later as a `src/i18n/strings.ts`-style preference toggle.

---

## Further Notes

- The locked DS values (`#E30613`, `#009639`, `#FF8000`, Space Grotesk + Inter, JetBrains Mono, `ROUND_FOUR`, dark) come from `docs/IMPLEMENTATION_PLAN.md §1` and stay pinned.
- The Stitch screens re-use the existing **Apex Velocity** design-system asset already attached to the project; no new design system has to be created.
- `BESTSECTORS` rows come without `NR` for many classes — the heatmap is **class-level only** by design, no per-car drill from the heatmap itself.
- The **theoretical best** uses the `BESTSECTORS[CLASS=TOTAL]` row when present; if absent, it falls back to summing the column-best per sector across all classes. Document this fallback in the `classKpis` JSDoc.
- The **driver/team** column is best-effort: PID 0 RESULT may lag PID 9002 by a few seconds at session start. Render em-dash, not a spinner.
- The follow-up issue should track: (1) E2E harness for fixture injection, (2) CSV export, (3) per-driver stat view inside the drilldown.
