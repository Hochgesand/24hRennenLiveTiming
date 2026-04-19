# PRD — Statistics Cockpit (Statistik-Tab Redesign)

> Companion to `PRD.md` (wire/store contract is unchanged) and `PRD-design-overhaul.md` (Telemetric-Cockpit DS is locked). This PRD scopes the **Statistik tab** redesign on Desktop, Tablet, and Mobile, the new derive helpers, the visualisations, the wire-up to the existing `useLiveStore` / `useFilterStore`, **and the App-Shell refactor (Side-Nav on Desktop, Brand-Header, Bottom-Nav on Mobile) required to reach 1:1 visual parity with the locked Stitch screens.** Stitch is the **source of truth** here — the rendered HTML at `docs/stitch-html/stats-cockpit-{desktop,mobile}.html` is the spec the React tree must match cell-for-cell. The Stitch project lives at `projects/13661023061589856813`.

**This PRD overrides `PRD-design-overhaul.md §3.19` ("Stitch is reference, not source") for the Statistik scope and the surrounding shell.** The wire/store contract from `PRD.md` is untouched.

---

## Problem Statement

As a motorsport fan and analyst opening the **Statistik** tab during the ADAC 24h Nürburgring, I see three plain HTML tables (`LEADING`, `BESTLAPS`, `BESTSECTORS`) rendered straight from the PID 9002 payload — no filter, no hierarchy, no visual cue, no clickable hand-off into a car drilldown. During a real session there are roughly **125 leading rows**, **154 best-lap rows** and **1356 best-sector rows** in store memory, so the tab is in practice unreadable on every device. Mobile gets the desktop layout in one column with horizontal scroll only on the Class column, which makes the tab an immediate pain point on phones.

Reference: current state on event 50 / config w3 — see `docs/screenshots/current-stats-tab-desktop.png` and `docs/screenshots/current-stats-tab-mobile.png`.

## Solution

Replace `<StatisticsPanel>` with a **Statistics Cockpit** that matches the Stitch HTML 1:1, **and migrate the surrounding shell to the same Stitch contract** so the tab does not float on top of a different chrome:

1. **Desktop shell** (≥ `lg`): replace the horizontal `<Tabs>` row inside `<DashboardShell>` with a **fixed 256 px Side-Nav** (`Cockpit / Rangliste / Statistik / Streckenkarte / Top-Qualifying / Meldungen`) and a **64 px brand top-bar** carrying `LIVE TIMING | 24H NÜRBURGRING` (override of Stitch's "KINETIC EDGE | N24") plus the existing live-state dot. The reserved 40 px live-state ribbon (`LIVE_TELEMETRY_STREAM_CONNECTED`) sits between the top-bar and the tab content. `<SessionHeader>` is collapsed into the new top-bar; `<PodiumRibbon>` continues to live above the band content but inherits the Stitch `bg-surface-container-lowest/50` strip styling.
2. **Mobile shell** (`<lg`): the existing `<MobileShell>` keeps its 56 px top-bar (re-skinned to the Stitch `LIVE TIMING` / red brand + LIVE chip) and replaces the bottom-nav labels with `**Rennen / Statistik / Meldungen / Setup`** as in `stats-cockpit-mobile.html` (matches the Race/Stats/Messages/Settings tab IDs we already use).
3. **Statistik tab content** — the four bands. KPI strip → class-filter chips → 60/40 grid (best-lap **HTML-bar** chart + sector **heatmap `<table>`**) → enriched leading table. The two visualisations are **plain Tailwind DOM**, not Recharts and not CSS-grid — see `stats-cockpit-desktop.html` lines 173–338 for the canonical markup.
4. **Mobile reflow** of the tab: 2×2 KPI grid, horizontally scrollable class-filter chips, sticky-first-column heatmap `<table>`, top-5 best-lap bars with "Mehr anzeigen ↓", and a card-list of class leaders with a 2 px red left stripe and chevron — see `stats-cockpit-mobile.html` lines 137–326.

All four bands share one `<StatsClassFilter>` chip bar, persisted via the existing `useFilterStore` pattern (new `excludedStatsClasses` slice mirroring `excludedClasses`).

We do **not** introduce Chart.js. We **also drop Recharts for this tab** — the Stitch concept renders both visualisations as inline DOM, which is lighter, pixel-deterministic, easier to test against the HTML spec, and matches Stitch's color/opacity tokens directly. Recharts stays in use for `<LapTimeChart>` and `<LeaderDeltaChart>` (Car Drilldown), which are out of scope here.

Stitch source-of-truth files (locked DS = Telemetric Cockpit, dark, `#E30613`, Space Grotesk + Inter, JetBrains Mono numerics):

- Desktop **HTML** (binding spec): `docs/stitch-html/stats-cockpit-desktop.html`
- Mobile **HTML** (binding spec): `docs/stitch-html/stats-cockpit-mobile.html`
- Desktop screen: `projects/13661023061589856813/screens/dfe198ab03994998bc4621f13f9c0429` ("ADAC 24h NBR: Statistics Cockpit", 2560×2608) — PNG: `docs/screenshots/stitch-stats-cockpit-desktop.png`.
- Mobile screen: `projects/13661023061589856813/screens/2544b52d739c4520b8fc508d184a3661` ("Statistik: ADAC 24h Nürburgring", 780×2590) — PNG: `docs/screenshots/stitch-stats-cockpit-mobile.png`.

### Stitch Fidelity Contract

These rules are binding for the implementation:


| #   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | The React DOM **mirrors the Stitch HTML structure** for every visible band (top-bar, side-nav, podium ribbon, live-state ribbon, KPI strip, class-filter, bar chart, sector heatmap, leading table, mobile bottom-nav). The same Tailwind utility classes are applied unless an explicit override is listed below.                                                                                                                                                                                                                                                                                                                                                             |
| F2  | **Brand override:** the desktop top-bar reads `LIVE TIMING` + small caption `24H NÜRBURGRING` (replaces Stitch's `KINETIC EDGE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| F3  | **Side-nav items** map to existing app tabs and use the existing route IDs: `Cockpit` → `leaderboard` (overview), `Rangliste` → `leaderboard`, `Statistik` → `stats`, `Streckenkarte` → `trackmap`, `Top-Qualifying` → `stq` (only when `sessionMeta.STQ`), `Meldungen` → `messages`. The Stitch placeholder items (`Pit Lane`, `Weather`) are dropped — they have no backing data.                                                                                                                                                                                                                                                                                            |
| F4  | **Sub-tabs `Statistik / Verlauf / Delta_AI`** in the Stitch desktop layout are kept visually for spec parity, but `Verlauf` and `Delta_AI` render as **disabled** (`aria-disabled`, `cursor-not-allowed`, `opacity-40`) with a `title="Kommt in v2"`. They do not navigate.                                                                                                                                                                                                                                                                                                                                                                                                    |
| F5  | **Mobile bottom-nav** uses the Stitch labels in German exactly: `Rennen / Statistik / Meldungen / Setup`. The icons are Material Symbols Outlined `speed / leaderboard (FILL=1 when active) / notifications / settings`.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F6  | **Custom Tailwind colour tokens** from the Stitch config (`surface-container-low/lowest/high/highest`, `primary-container`, `secondary-container`, `tertiary-container`, `on-surface`, `on-primary-container`, `outline-variant`, `secondary`, `tertiary`, `primary`) are added to `src/index.css` as CSS variables, and to `tailwind.config.ts` so Stitch utility classes work out-of-the-box. The existing `--stitch-*` variables stay; the new ones are added in parallel.                                                                                                                                                                                                  |
| F7  | **Bar chart is plain DOM**: each row is a `<div class="space-y-1">` with a `<div class="h-2 bg-zinc-900 overflow-hidden">` track and a `<div class="h-full bg-red-600/{X} w-[Y%]"></div>` fill. Width and opacity are computed from `bestLapsByClass` (fastest = `w-full bg-red-600`, ramping down to `bg-red-600/20 w-[78%]`). No SVG, no Recharts.                                                                                                                                                                                                                                                                                                                           |
| F8  | **Sector heatmap is a `<table>`** with `border-separate border-spacing-px`. Each cell is a `<td>` with `bg-red-600/{opacity}` where `opacity ∈ {100, 90, 80, 70, 60, 50, 40, 30, 20, 10}` chosen by quantile of `(t − colBest) / colBest`. The class column is `<td class="bg-zinc-900 text-left">`, the trailing `LAP` column is `<td class="bg-zinc-800">`. Mobile uses the variant from `stats-cockpit-mobile.html` lines 188–229: cells render an inline `<span class="bg-{secondary,primary,tertiary}-container/20 text-{secondary,primary,tertiary} px-1 rounded-sm">` instead of solid backgrounds, and the first column is `position: sticky; left: 0; bg-background`. |
| F9  | **Leading table** uses the Stitch zebra: alternating `bg-surface-container-lowest/40` and `bg-surface-container-low`, header `bg-zinc-900/50`, class column `text-red-600 font-bold font-headline`, gap column either `text-secondary-container` (Leader) or `text-zinc-500`. Mobile uses the card variant with `border-l-2 border-primary-container` from `stats-cockpit-mobile.html` lines 290–325.                                                                                                                                                                                                                                                                          |
| F10 | **No new icons.** Material Symbols Outlined is loaded once globally (already pulled by Stitch); we keep using it for the `dashboard / leaderboard / analytics / tire_repair / cloudy_snowing / bar_chart / grid_on / chevron_right / speed / notifications / settings / timer / menu` glyphs.                                                                                                                                                                                                                                                                                                                                                                                  |
| F11 | **Search / Notifications / Settings buttons** in the Stitch desktop top-bar are kept visually but stubbed: Search opens nothing (no-op + `data-todo`), Notifications + Settings open the existing `settings drawer` (Settings) and a no-op (Notifications). Real wiring is out of scope here.                                                                                                                                                                                                                                                                                                                                                                                  |
| F12 | **Visual regression test** (Playwright + `@playwright/test` toMatchAriaSnapshot or pixel snapshot) compares `/event=50?config=w3&tab=stats` against the two Stitch HTML files at `1440×900` and `390×844`. Diff > 2 % fails CI. Fixture-injected via mocked WebSocket; the harness lives in `tests/playwright/fixtures/`.                                                                                                                                                                                                                                                                                                                                                      |


## User Stories

> Tracking: erledigte Stories als ~~durchgestrichener Originaltext~~ markieren, offene mit `- [ ]`.

### Statistik tab — KPI strip

1. **[done]** As a spectator, I want to see the **schnellste Runde des Rennens** (lap time + class + #NR) as a hero KPI in the Statistik tab, so that I do not have to scan a 154-row table to find it.
2. **[done]** As an analyst, I want a **theoretische Bestzeit TOTAL** KPI (sum of column-bests across S1..Sn from `BESTSECTORS` for `CLASS=TOTAL`), so that I can see what the fastest lap on this circuit could currently be.
3. **[done]** As an analyst, I want a **Δ Real → Theoretisch** KPI rendered with race-green sign (positive = unused potential) so that I instantly see how much performance is left on the table.
4. **[done]** As a spectator, I want an **Aktive Klassen** KPI (count of distinct CLASS values in `LEADING`, excluding `TOTAL`) plus the raw `LEADING` count as caption, so that I have a sense of grid scope.
5. **[done]** As a developer, I want all KPI numbers rendered with `JetBrains Mono` and the `formatLapSeconds` helper so deltas and lap times line up across the dashboard.
6. **[done]** As a viewer with no live event data, I want the KPI strip to render a skeleton (4 placeholder cards with em-dash values), so that the tab does not collapse to a single "No statistics" string.

### Statistik tab — class filter

1. **[done]** As a spectator, I want a **horizontal chip bar** of all classes present in PID 9002 (deduped from `LEADING.CLASS ∪ BESTLAPS.CLASS ∪ BESTSECTORS.CLASS`), so that I can hide noise and focus on a class group.
2. **[done]** As a returning user, I want my class selection to **persist across reloads** (URL param `statsExcludedClasses=` + same lazy-hydration pattern as `excludedClasses`), so that my view stays put when refreshing during a 24h race.
3. **[done]** As a power user, I want a **Reset** link at the right edge of the chip bar to clear all exclusions in one click.
4. **[done]** As a user on mobile, I want the chip bar to **horizontally scroll with a fade mask** at the right edge, so that I can still discover all classes without losing layout density.
5. **[done]** As a developer, I want the chip bar to also drive the bar chart, the heatmap and the leading table from the **same** filtered class set, so that the four bands stay consistent.

### Statistik tab — best-lap-per-class bar chart

1. **[done]** As an analyst, I want a **horizontal bar chart** of best lap per class rendered as plain Tailwind DOM (`<div class="h-2 bg-zinc-900"><div class="h-full bg-red-600 w-[X%]" /></div>`) per spec rule F7, so that the visualisation matches `stats-cockpit-desktop.html` lines 215–275 cell-for-cell.
2. **[done]** As a viewer, I want bars **sorted ascending by lap time** (fastest at top), so that the visual order matches "best".
3. **[done]** As a viewer, I want the lap-time label rendered at the **end of each bar** in `JetBrains Mono`, formatted as `m:ss.SSS` via the existing `formatLapSeconds` helper.
4. **[done]** As a viewer, I want each bar **coloured by rank** with red opacity stops `bg-red-600` (rank 1) → `/80` → `/60` → `/40` → `/20`, with the relative width computed from `(fastest / current)` capped at 100 %, exactly mirroring the Stitch HTML.
5. **[done]** As a viewer, I want a **tooltip on hover** with the full set: class, #NR, lap time, day-time, and (if present in PID 0 RESULT) driver/team name from the joined row. Implementation note: native HTML `title=` + `aria-label=` on each `<li>` (the codebase has no shadcn Tooltip; native `title` is dependency-free, screen-reader accessible, and consistent with rule F4).
6. **[done]** As a mobile user, I want the chart to render **only the top 5 bars** by default with a "Mehr anzeigen ↓" link (Stitch `stats-cockpit-mobile.html` line 283) that expands to show all classes.

### Statistik tab — sector heatmap

1. **[done]** As an analyst, I want a **sector heatmap matrix** with rows = class and columns = `S1..Sn` (n derived dynamically via `maxSectorColumns`, no hardcoding to 9), so that the matrix shrinks/grows with the actual circuit layout.
2. **[done]** As an analyst, I want each desktop cell shaded with `**bg-red-600/{opacity}`** where opacity ramps `100 / 90 / 80 / 70 / 60 / 50 / 40 / 30 / 20 / 10` by quantile of `(cell − columnBest) / columnBest`, exactly mirroring `stats-cockpit-desktop.html` lines 295–334. Mobile uses the **inline-pill variant** (`<span class="bg-{secondary,primary,tertiary}-container/20 …">`) per `stats-cockpit-mobile.html` lines 191–211, where colour encodes which class owns the column-best.
3. **[done]** As an analyst, I want each cell to display the **absolute sector time** in mono ~10–11 px and to expose a tooltip with the **delta vs. column-best** (`+0.142 s`, `+1.81 %`).
4. **[done]** As an analyst, I want a final **LAP** column appended after S-columns showing `BESTSECTORS[i].LAPTIME` in `bg-zinc-800` (desktop) or `text-right font-bold` (mobile), matching the Stitch markup.
5. **[done]** As a mobile user, I want the matrix to **horizontally scroll with a sticky first column** (`position: sticky; left: 0; bg-background`), so that the row label never disappears.
6. **[done]** As a developer, I want the heatmap implemented as a `**<table>` with `border-separate border-spacing-px`** (Stitch markup), not as a CSS grid. Cells are `<td>` so semantic table semantics carry the row/col headers; each interactive cell additionally exposes `aria-label` and `title` for the delta tooltip.
7. **[done]** As a desktop user, I want the heatmap to take **40 %** of the main band width (`lg:col-span-4` of a `lg:grid-cols-10`), the bar chart **60 %** (`lg:col-span-6`), per Stitch `<div class="grid lg:grid-cols-10 gap-6">`.
8. **[done]** As an analyst, I want a click on a heatmap row's class label to **scroll the leading table** to the matching class row and highlight it for 1.5 s (no drilldown if the row has no `NR`).

### Statistik tab — enriched leading table

1. **[done]** As a spectator, I want a **Klassen-Führende** table with columns: Klasse, #, Fahrer / Team, Runden, Gap, Zeit gesamt, seit Runde, so that the leading slice of PID 9002 is immediately readable.
2. **[done]** As a developer, I want the **driver / team** column derived by joining `LEADING.NR` with `useLiveStore.snapshot.RESULT[*].STNR` (string match on the trimmed wire value), falling back to em-dash if no row found.
3. **[done]** As a fan, I want a click on the **#NR cell** to open the existing `<CarDrilldownDialog>` for that car number, so that I can immediately see lap-time chart and stints.
4. **[done]** As a power user, I want the table **sortable by Klasse, Runden, Gap, Zeit gesamt** via column header click, with a single sort key at a time.
5. **[done]** As a viewer, I want the table to inherit the **sticky header** + alternating zebra rows (`surface_container_low` / `_lowest`) defined in the design system, so density stays high.
6. **[done]** As a mobile user, I want each row collapsed to a **2-line card with a 2 px red left stripe**: line 1 = `«Klasse» · Runde N · «Gap»` (mono), line 2 = `#«NR»  «Fahrer / Team»`, with a chevron right hinting the drilldown.

### Empty / loading / error states

1. **[done]** As a viewer of a session **without PID 9002 yet** (Pre-session, or right after `LTS_TIMESYNC`), I want the tab to render a **skeleton with KPI placeholders, an empty chip bar, and a single "Statistik wird geladen…" line**, instead of the current "No statistics" string.
2. **[done]** As a viewer in a `LTS_NOT_FOUND` event, I want the existing `<EventNotFoundOverlay>` to keep priority over this tab, so the cockpit redesign does not mask the connection error (verified — handled by App.tsx, see App.test.tsx).
3. **[done]** As a viewer when WebSocket is reconnecting, I want the band content to **dim to 60 % opacity** but remain visible (no flash to placeholder), so I do not lose context for the few seconds of a reconnect.

### Internationalisation

1. **[offen]** As a German-speaking spectator, I want every label (`Statistik`, `Klassen-Führende`, `Schnellste Runde`, `Beste Sektor-Splits`, …) routed through `src/i18n/strings.ts`, with `de` as primary and `en` available, so that the tab matches the rest of the dashboard.

### URL / shareability

1. **[offen]** As a Twitter/Discord poster, I want `?tab=stats` and `?statsExcludedClasses=Cup3,V6` to round-trip through the URL, so that I can deep-link a colleague to a filtered view.

### Test data & determinism

1. **[offen]** As a developer, I want a **fixture** (`src/lib/__fixtures__/pid9002.event50.json`) captured from event 50 / config w3 (date `2026-04-19`), so that the new derive helpers are unit-testable on real, representative data.

### Performance

1. **[offen]** As a developer, I want the four bands wrapped in `React.memo` and the derive helpers memoised on the `(statistics, snapshot, excludedStatsClasses)` triple, so that re-renders triggered by unrelated PID 0/3/4 frames do not retrigger heatmap layout.

### Accessibility

1. **[offen]** As a screen-reader user, I want each heatmap cell to expose `aria-label="Klasse «X», Sektor «Sn», Zeit «t», Δ «d»"`, so that the matrix is operable beyond the visual encoding.
2. **[offen]** As a keyboard user, I want side-nav, sub-tabs, chip bar, table headers, table rows, and heatmap cells reachable via Tab with visible focus rings (the existing `outline_variant` 30 % token).

### App shell — Stitch 1:1 migration (NEW BAND)

1. **[done]** As a power user on Desktop ≥ `lg`, I want a **fixed 256 px Side-Nav** on the left (Stitch `stats-cockpit-desktop.html` lines 116–148) with items `Cockpit · Rangliste · Statistik · Streckenkarte · Top-Qualifying · Meldungen` (per spec rule F3), each rendered as a Material Symbols icon + uppercase headline label, the active item shown as `bg-red-600/10 text-red-600 border-l-4 border-red-600`. The horizontal `<TabsList>` currently in `<DashboardShell>` is removed on `≥ lg`.
2. **[done]** As a viewer, I want a **64 px brand top-bar** on Desktop reading `**LIVE TIMING | 24H NÜRBURGRING`** (italic, `font-headline`, `text-red-600`, brand override per F2), with the existing Search / Notifications / Settings icon buttons aligned right (search + notifications stub per F11; Settings opens the existing settings drawer).
3. **[done]** As a viewer, I want the live-state ribbon `LIVE_TELEMETRY_STREAM_CONNECTED` (Stitch lines 152–157) directly under the brand top-bar, with the existing `<ConnectionBanner>` content piped into it (red pulse dot + dynamic state text), so that the WebSocket status is visible from any tab.
4. **[done]** As a developer, I want `**<SessionHeader>` collapsed into the new top-bar / ribbon** rather than rendered as a third row, so vertical density matches Stitch.
5. **[done]** As a viewer on a session **without STQ**, I want the `Top-Qualifying` Side-Nav item hidden (mirrors current `stqVisible` behaviour).
6. **[done]** As a viewer on Desktop, I want **disabled sub-tabs `Verlauf` and `Delta_AI`** rendered next to the active `Statistik` tab (Stitch lines 166–170) per F4, with `aria-disabled` and a `title="Kommt in v2"` tooltip, so the Stitch markup is preserved.
7. **[done]** As a viewer on Mobile, I want the bottom-nav labels to read `**Rennen · Statistik · Meldungen · Setup`** (per F5), driving the existing `race / stats / messages / settings` tab IDs and using the Stitch icon set + active styling (`text-[#E30613] border-t-2 border-[#E30613] bg-[#2a2b2c]`).
8. **[done]** As a developer, I want all **Stitch custom Tailwind colour tokens** (`primary-container`, `secondary-container`, `tertiary-container`, `surface-container-low / lowest / high / highest`, `outline-variant`, `on-surface`, `on-primary-container`, `secondary`, `tertiary`, `primary`) defined as CSS variables in `src/index.css` and exposed via `tailwind.config.ts`, so that copy/pasted Stitch HTML class lists work as-is (per F6).
9. **[offen]** As a designer, I want a **visual-regression test** (per F12) that diffs `/event=50?config=w3&tab=stats` against `docs/stitch-html/stats-cockpit-desktop.html` at 1440×900 and `stats-cockpit-mobile.html` at 390×844, failing CI on > 2 % pixel diff. This is the gate that proves "1:1".
10. **[done]** As a maintainer, I want every other tab (`Rangliste`, `Meldungen`, `Streckenkarte`, `Top-Qualifying`) to **continue rendering inside the new shell** without visual regressions, so the migration does not break unrelated screens. Verified by the existing visual snapshots for those tabs (or new ones added in this PR).

---

## Implementation Decisions

### New / modified modules

#### Tab-content (Statistik)

- `**src/lib/statistics.ts` — pure derive (NEW, deep module).** Exposes:
  - `classKpis(stats, snapshot)` → `{ fastestLap, theoreticalBestSeconds, deltaSeconds, activeClasses, leadingCount }`.
  - `bestLapsByClass(stats, opts: { excludedClasses })` → `Array<{ className, nr, lapTimeSeconds, lapTimeLabel, daytime, driverTeam, widthPct, opacityStop }>` sorted ascending. `widthPct` and `opacityStop` are pre-computed for the HTML-bar renderer (rule F7) so the React component is a pure mapping.
  - `sectorHeatmap(stats, opts)` → `{ classes: string[], sectorCount: number, cells: number[][], absLabels: string[][], deltas: number[][], opacityStops: number[][], columnBests: number[] }`. `opacityStops[i][j] ∈ {10,20,…,100}` is precomputed by quantile so the React `<td>` only needs `bg-red-600/{stop}`.
  - `theoreticalBestForClass(stats, className)` → `number | null`.
  - `enrichedLeading(stats, snapshot, opts)` → `Array<{ className, nr, laps, sum, fromLap, gap, driverTeam }>`.
  - All helpers take **already-validated row arrays**; they do not call `asRows` themselves. They never read from `useLiveStore`. They reuse `parseLapTimeToSeconds` / `formatLapSeconds` from `lapTimes.ts`.
- `**src/store/useFilterStore.ts` — extend.** Add `excludedStatsClasses: Set<string>`, `toggleExcludedStatsClass`, `clearExcludedStatsClasses`, `setExcludedStatsClasses`. Mirror persistence into `urlFilters.ts` via key `statsExcludedClasses=` (comma-separated).
- `**src/lib/urlFilters.ts` — extend.** Add the new key end-to-end (parse + serialise + test).
- `**src/components/stats/StatisticsCockpit.tsx` (NEW).** Composes the four bands. Renders skeleton when `useLiveStore(s => s.statistics)` is `null`. **Markup mirrors `docs/stitch-html/stats-cockpit-desktop.html` lines 159–429** for `lg+`, and `stats-cockpit-mobile.html` lines 135–327 for `<lg`. The component is split per Stitch `<section>`; class lists are copied from the HTML and only data attributes are dynamic.
- `**src/components/stats/StatsKpiStrip.tsx` (NEW).** 4-card row (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`), 2×2 on mobile. Each card matches Stitch lines 174–201 (desktop) / 137–158 (mobile).
- `**src/components/stats/StatsClassFilter.tsx` (NEW).** Horizontal chip bar; desktop = `flex flex-wrap` with `Filter_Klasse:` prefix label; mobile = `flex overflow-x-auto no-scrollbar`. Active chip = `bg-primary-container text-on-primary-container`, inactive = `bg-surface-container-highest` (desktop) / `border border-outline-variant text-gray-400` (mobile). Uses `useFilterStore`.
- `**src/components/stats/BestLapPerClassChart.tsx` (NEW).** **Plain Tailwind DOM** (no Recharts). Each row = `<div class="space-y-1"><div class="flex justify-between …">label + time</div><div class="h-2 bg-zinc-900 overflow-hidden"><div class="h-full bg-red-600/{opacityStop} w-[{widthPct}%]" /></div></div>`. Top-5 default + "Mehr anzeigen ↓" expand on mobile. Hover-tooltip via shadcn `<Tooltip>`.
- `**src/components/stats/SectorHeatmap.tsx` (NEW).** `**<table>` with `border-separate border-spacing-px`**, not CSS-grid. Class column `<td class="bg-zinc-900 text-left font-headline font-bold pr-2">`, sector cells `<td class="bg-red-600/{opacityStop} py-2">{absLabel}` + `aria-label` per F8/F23. Mobile renders the inline-pill variant (`<span>` per cell) with sticky first column. Header `<th>` set covers `KLS · S1..Sn · LAP`.
- `**src/components/stats/LeadingTable.tsx` (NEW).** Desktop = `<table>` with Stitch zebra and column headers `Klasse · # · Fahrer/Team · Runden · Gap · Zeit gesamt` (lines 350–426). `#NR` cell opens `<CarDrilldownDialog>` via the existing dialog store. Mobile = `<ul>` of cards (`border-l-2 border-primary-container p-3`) per Stitch lines 290–325.
- `**src/components/StatisticsPanel.tsx` — DELETE.** `<DashboardShell>` and `<MobileShell>` switch their `value="stats"` body to `<StatisticsCockpit />`.
- `**src/i18n/strings.ts` — extend.** Add `stats.kpi.`*, `stats.filter.`*, `stats.bestLap.*`, `stats.heatmap.*`, `stats.leading.*`, `shell.brand.*`, `shell.sideNav.*`, `shell.subTabs.*`, `shell.bottomNav.*` keys for `de` and `en`. German strings are the Stitch literals.

#### App shell — Stitch 1:1 migration

- `**src/components/shell/AppShell.tsx` (NEW).** Single shell that picks Desktop or Mobile sub-tree by `useBreakpoint()`. Renders the brand top-bar, the live-state ribbon, the side-nav (desktop) or bottom-nav (mobile), and slots the active tab content via children. Replaces the layout responsibilities currently split between `DashboardShell` and `MobileShell`.
- `**src/components/shell/BrandTopBar.tsx` (NEW).** 64 px `bg-zinc-950/90 backdrop-blur-xl` with `LIVE TIMING` (italic, red, headline) + `24H NÜRBURGRING` caption + Material Symbols Search/Notifications/Settings buttons. Mobile variant = 56 px with menu icon + `LIVE TIMING` + LIVE-state pill.
- `**src/components/shell/SideNav.tsx` (NEW, desktop only).** 256 px fixed left aside. Items per F3, active state per Stitch line 130. Bottom CTA `LIVE FEED` keeps the Stitch markup but is wired to the existing settings drawer (or a no-op until a use case lands).
- `**src/components/shell/StatsSubTabs.tsx` (NEW, desktop only).** The `Statistik / Verlauf / Delta_AI` row above the KPI strip. `Verlauf` and `Delta_AI` are `aria-disabled` per F4.
- `**src/components/shell/MobileBottomNav.tsx` (NEW, replaces existing bottom-nav of `MobileShell`).** Per F5: `Rennen · Statistik · Meldungen · Setup` with the Stitch active-tab styling.
- `**src/components/shell/LiveStateRibbon.tsx` (NEW).** 40 px `bg-surface-container-lowest/50` with red pulse dot + status text fed by the existing `useConnection()` hook. Replaces the visible row of `<ConnectionBanner>` for the connected state; the banner stays mounted to handle reconnect overlays.
- `**src/components/SessionHeader.tsx` — DELETE / fold into `BrandTopBar`.** Event-name + session-timer become a small caption inside the top-bar; track-state + WS-dot move into `LiveStateRibbon`.
- `**src/components/DashboardShell.tsx` and `src/components/MobileShell.tsx` — REPLACED by `<AppShell>`.** The old files are removed in the same PR.
- `**src/index.css` — extend.** Add CSS variables for the Stitch tokens listed in F6; map them in `tailwind.config.ts` so that Stitch utility class names (`bg-surface-container-low`, `text-on-primary-container`, `border-outline-variant`, …) work directly. Material Symbols Outlined is loaded once in `index.html` as it already is.
- `**tailwind.config.ts` — extend.** `theme.extend.colors` += the Stitch tokens; `fontFamily` already includes Space Grotesk + Inter + JetBrains Mono via the design overhaul. Add `fontFamily.headline = ['Space Grotesk', …]` aliases per Stitch config (lines 79–83).

### Architectural choices

- **No Chart.js, no Recharts, no SVG for this tab.** Both visualisations render as plain Tailwind DOM per F7/F8. This keeps the bundle smaller, makes the component testable against the Stitch HTML directly, and removes one source of layout drift.
- **Heatmap is a `<table>`, not a CSS grid.** Stitch chose a table; we honour that for spec parity, accessibility (semantic table headers), and sticky-first-column on mobile via `position: sticky; left: 0`.
- **Pre-compute all Tailwind dynamic classes in the derive layer.** `widthPct`, `opacityStop`, and quantile-binned cell colours are produced by `src/lib/statistics.ts`, never by JSX. This keeps `dynamic-class` patterns out of the components and lets the JIT pick the classes up via the `safelist` (we add `bg-red-600/{10,20,…,100}` and `w-[{n}%]` exemplars to `tailwind.config.ts`).
- **Driver/team join is read-only.** `enrichedLeading` builds an `STNR → row` index from PID 0 RESULT once per snapshot change; it never mutates the store. If RESULT is empty, the column shows em-dash.
- **State stays in zustand.** No new context. The only new persisted values are `excludedStatsClasses` (URL param mirrors `excludedClasses` exactly) and an optional `?subTab=` reserved for `verlauf / delta_ai` once they ship.
- **No new wire frames.** All data is in PID 9002 + PID 0 RESULT, both already streamed and stored.
- **No SSR / no server.** This stays a static frontend.
- **Shell migration is the gate.** Tab content and shell ship in one PR — the visual-regression test (F12) only passes when both the Stitch tab markup and the new shell are in place. We do **not** ship a half-state where the cockpit lives inside the old horizontal-tab shell.

### API contract (TypeScript shapes)

- `ClassKpis = { fastestLap: { className, nr, lapTimeSeconds, lapTimeLabel } | null; theoreticalBestSeconds: number | null; deltaSeconds: number | null; activeClasses: number; leadingCount: number }`
- `BestLapRow = { className: string; nr: string; lapTimeSeconds: number; lapTimeLabel: string; daytime: string | null; driverTeam: string | null }`
- `SectorHeatmap = { classes: string[]; sectorCount: number; cells: number[][]; absLabels: string[][]; deltas: number[][]; columnBests: number[] }` — `cells[i][j]` is the relative delta `(t − colBest) / colBest`, `NaN` for missing.
- `EnrichedLeadingRow = { className: string; nr: string; laps: number | null; sum: string | null; fromLap: string | null; driverTeam: string | null; gapToBest: string | null }`

### Out-of-tree references

- **Binding spec — desktop HTML**: `docs/stitch-html/stats-cockpit-desktop.html` (449 lines, downloaded from Stitch).
- **Binding spec — mobile HTML**: `docs/stitch-html/stats-cockpit-mobile.html` (348 lines, downloaded from Stitch).
- Stitch desktop screen: `dfe198ab03994998bc4621f13f9c0429` (in project `13661023061589856813`). PNG checked in at `docs/screenshots/stitch-stats-cockpit-desktop.png`.
- Stitch mobile screen: `2544b52d739c4520b8fc508d184a3661`. PNG at `docs/screenshots/stitch-stats-cockpit-mobile.png`.
- Current state PNGs: `docs/screenshots/current-stats-tab-{desktop,mobile}.png`.

---

## Testing Decisions

A good test here exercises **observable behaviour and Stitch parity**: given a captured PID 9002 + PID 0 RESULT fixture, the derive output matches a snapshot of expected rows; given a user click on a chip, the chart and table both filter; given a click on a heatmap row label, the leading table scrolls to that class. **The Stitch HTML files are the visual contract** — a Playwright pixel-snapshot test compares the rendered tab against the static HTML at the two reference viewports. We do **not** test individual Tailwind class lists by name (too brittle); we test pixel diff + ARIA structure.

### Modules to test

- `**src/lib/statistics.test.ts` (Vitest, NEW).** Covers `classKpis`, `bestLapsByClass`, `sectorHeatmap`, `theoreticalBestForClass`, `enrichedLeading`. Edge cases: empty PID 9002, PID 9002 without TOTAL row, sectors of mixed length per class (4 vs 6 vs 9), `LEADING.NR` not present in PID 0 RESULT, duplicate class names. Verifies `widthPct` and `opacityStop` quantile binning. Uses fixtures captured from event 50 (`src/lib/__fixtures__/pid9002.event50.json` + `pid0.event50.json`).
- `**src/lib/urlFilters.test.ts` (extend existing).** Round-trip `statsExcludedClasses` through parse + serialise; assert URL is shorter than 2000 chars for the worst case (~30 classes × avg 6 chars). Same parameterised pattern as existing `excludedClasses` tests.
- `**src/components/stats/StatisticsCockpit.test.tsx` (RTL, NEW).** Render with the fixture frame, assert: KPI values render in mono, chip bar shows all unique classes with `TOTAL` selected by default, clicking a chip toggles the class out of the bar chart and the table, clicking `#NR` triggers drilldown open. Query by `role` / `aria-label` only.
- `**src/components/stats/SectorHeatmap.test.tsx` (RTL, NEW).** Render with a 3-class × 4-sector synthetic input; assert each `<td>` carries the expected `aria-label="Klasse «X», Sektor «Sn», Zeit «t», Δ «d»"`, that the first column is `scope="row"` (sticky on mobile via `data-sticky="true"`), and that clicking the row label fires `onClassActivate`.
- `**src/components/stats/BestLapPerClassChart.test.tsx` (RTL, NEW).** Assert that `widthPct` / `opacityStop` from the derive layer flow into the bar's class string (`bg-red-600/{stop}` token + `style.width` percentage); test the mobile expand toggle (top-5 ↔ all) and tooltip content.
- `**src/components/shell/AppShell.test.tsx` (RTL, NEW).** Side-nav active state matches the `tab` URL param; sub-tabs `Verlauf` and `Delta_AI` are `aria-disabled`; mobile bottom-nav labels are exactly `Rennen / Statistik / Meldungen / Setup`. Brand text reads `LIVE TIMING` + `24H NÜRBURGRING`.
- `**tests/playwright/stats-cockpit.spec.ts` (NEW, gate per F12).** Boots the app with a fixture-injected `useLiveConnection` (mocked PID 9002 + PID 0 RESULT from event 50), navigates to `/event=50?config=w3&tab=stats`, takes a viewport screenshot at 1440×900 and 390×844, diffs against the rendered Stitch HTML files via a tiny `tests/playwright/fixtures/render-stitch.ts` harness. Pixel diff > 2 % fails CI.
- `**tests/playwright/shell.spec.ts` (NEW).** Smoke test for the shell migration: navigates to `?tab=leaderboard / messages / trackmap / stq` and confirms the side-nav, top-bar, and live-state ribbon render identically across tabs (no per-tab regression on the chrome).

### Prior art in repo

- `src/lib/lapTimes.test.ts` and `src/lib/leaderDeltaSeries.ts` — pure derive style.
- `src/lib/urlFilters.test.ts` — URL round-trip pattern.
- `src/lib/leaderboard.test.ts` — fixture-driven aggregation.

---

## Out of Scope

- Adding **Chart.js** or any new chart library — both visualisations are plain Tailwind DOM per F7/F8.
- **Re-skinning the Statistik tab without the shell migration** — the shell migration is part of this PR (per "Architectural choices: Shell migration is the gate"). A half-state with new content inside the old top-tab shell would fail the visual-regression test by definition.
- Functional wiring for **Search**, **Notifications**, **LIVE FEED CTA** in the new shell — these are visual stubs per F11.
- The `**Verlauf`** and `**Delta_AI`** sub-tabs as actual screens — they ship disabled per F4. Real screens are tracked as v2 follow-ups.
- A **time-series** view of how the fastest lap evolves over the session (would require keeping a history slice; PID 9002 is push-only snapshot).
- Per-driver stints / pit history inside the Statistik tab — that lives in the **Car Drilldown** dialog already.
- A separate **STQ statistics** view (PID 501 has its own tab).
- A **CSV / clipboard export** of the leading table (queue for v2).
- Re-styling the **Track Map / Heatmap** tab body (that is N4 in the design overhaul plan and stays untouched — it just lives inside the new shell).
- A **2nd accent colour scheme** for colour-blind users — added later as a `src/i18n/strings.ts`-style preference toggle.

---

## Further Notes

- The locked DS values (`#E30613`, `#009639`, `#FF8000`, Space Grotesk + Inter, JetBrains Mono, `ROUND_FOUR`, dark) come from `docs/IMPLEMENTATION_PLAN.md §1` and stay pinned.
- The Stitch screens re-use the existing **Apex Velocity** design-system asset already attached to the project; no new design system has to be created.
- `BESTSECTORS` rows come without `NR` for many classes — the heatmap is **class-level only** by design, no per-car drill from the heatmap itself.
- The **theoretical best** uses the `BESTSECTORS[CLASS=TOTAL]` row when present; if absent, it falls back to summing the column-best per sector across all classes. Document this fallback in the `classKpis` JSDoc.
- The **driver/team** column is best-effort: PID 0 RESULT may lag PID 9002 by a few seconds at session start. Render em-dash, not a spinner.
- The follow-up issue should track: (1) E2E harness for fixture injection, (2) CSV export, (3) per-driver stat view inside the drilldown.