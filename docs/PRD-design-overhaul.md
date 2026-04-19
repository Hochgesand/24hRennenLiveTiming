# PRD — Design overhaul to "Telemetric Cockpit" + responsive shell

> Companion to the original `PRD.md` (wire / decode / store contract is unchanged).
> Locks down the visual + responsive concept produced in Stitch project
> **Nürburgring 24h Live Timing** (`projects/13661023061589856813`) and the code
> changes needed to ship it. Implementation phasing lives in
> `docs/IMPLEMENTATION_PLAN.md`; this PRD describes **what** and **why**, not the
> day-by-day schedule.

---

## Problem Statement

As a motorsport fan opening the dashboard during the ADAC 24h Nürburgring, I see
a functional but visually inconsistent UI: a 3-column desktop grid with a
collapsible right rail, English labels on a German broadcast event, no track
map, no settings drawer, no mobile-first navigation, and no design system worth
the name. On a phone the experience devolves into three crammed tabs with no
podium and no drilldown affordance. It does not feel broadcast-grade and it
does not feel like the rest of the live-timing universe (Indycar, IMSA,
F1 official) that I am used to.

## Solution

Replace the current shell with a single locked design system — **Telemetric
Cockpit**, dark, Nürburgring red `#E30613`, Space Grotesk + Inter, JetBrains
Mono for numerics, sharp `ROUND_FOUR` corners — and three breakpoint-specific
shells:

- **Desktop (≥1280)** — tabbed full-bleed layout with a persistent header
  (event title, session timer, track state, WebSocket dot) and a slim podium
  ribbon. Tabs: Leaderboard, Stats, Messages, Track Map, STQ (conditional).
  Drilldown opens as a centered modal. Filters/columns live in a right-side
  drawer.
- **Tablet (≥768, <1280, portrait 1024×1366)** — same tab pattern, denser
  cells, podium ribbon collapses to a 2-row carousel after first scroll,
  drilldown opens as a bottom sheet.
- **Mobile (<768, target 390×844)** — bottom tab bar with 4 tabs (Race / Stats
  / Messages / Settings), compact session bar, mini horizontal-scrolling
  podium, drilldown as a 90 %-height bottom sheet with handle, safe-area
  padding.

The car drilldown gains a fully-formed content set: header, KPI strip, lap-time
line chart with PB and stint-avg reference lines, sector matrix, driver-stint
timeline, leader-delta area chart, and a reserved telemetry slot. German is the
primary UI language, English available via in-code i18n.

## User Stories

### Shell, header, and navigation

1. As a desktop spectator, I want the event title, session timer, track state
   and WebSocket connection dot to stay visible no matter which tab I am on,
   so that I never lose the broadcast context.
2. As a desktop spectator, I want a slim podium ribbon (top 3) pinned under the
   header on every tab, so that I can keep an eye on the leaders while reading
   stats or messages.
3. As a desktop spectator, I want primary navigation as tabs
   (Leaderboard / Stats / Messages / Track Map / STQ?), so that I can switch
   views with a single click and without losing the header.
4. As a desktop user, I want the STQ (Top Qualifying) tab to appear only when
   the active session actually has STQ data, so that I am not confused by an
   empty tab during a race.
5. As a tablet user (portrait 1024×1366), I want the same tab pattern as on
   desktop with denser cells, so that I do not have to learn a different mental
   model on my iPad.
6. As a tablet user, I want the podium ribbon to collapse into a 2-row carousel
   after the first scroll, so that more leaderboard fits above the fold.
7. As a mobile user, I want a fixed bottom tab bar (Race / Stats / Messages /
   Settings), so that I can reach all primary views with one thumb.
8. As a mobile user, I want a compact session bar at the top showing only the
   essentials (timer, flag, WS dot), so that the tiny screen is not wasted on
   chrome.
9. As a mobile user, I want a horizontally scrollable mini-podium under the
   session bar, so that I can swipe through P1–P3 without leaving the Race tab.
10. As a mobile user, I want the bottom tab bar to respect
    `env(safe-area-inset-bottom)`, so that it does not collide with the iOS
    home indicator.

### Leaderboard, columns, and filters

11. As a spectator, I want a default leaderboard column set
    (Pos · # · Class chip · Driver+Team stack · Gap · Last · Fastest · S1..Sn),
    so that the most-scanned data is visible without me configuring anything.
12. As a power user, I want a column picker exposing the hidden columns
    (Car/manufacturer · Pit count · Stint length · Tire compound · Best of
    class), so that I can tailor the table to my use-case.
13. As a power user, I want my column choices serialised into the URL via a
    `cols=` parameter, so that I can share my exact view as a link.
14. As a desktop spectator, I want filters and columns inside a right-side
    drawer triggered by a gear icon in the header, so that the leaderboard
    stays full-bleed when I am not configuring anything.
15. As a tablet user, I want the same drawer behaviour, so that filtering does
    not steal vertical space from the table.
16. As a mobile user, I want filters and columns inside the Settings tab
    instead of a drawer, so that I am not fighting with a side panel on a
    small screen.
17. As a spectator, I want the existing class and Pro/Am filters to keep
    working through this UI change, so that nothing regresses.
18. As a spectator, I want sector cells to retain their color coding
    (session-best · personal-best · overall-best · pit · in-lap · out-lap ·
    invalid · normal) under the new design tokens, so that hot spots remain
    instantly recognisable.

### Drilldown

19. As a desktop analyst, I want the car drilldown to open as a centered modal,
    so that the leaderboard context stays partially visible behind it.
20. As a tablet/mobile analyst, I want the drilldown to open as a bottom sheet
    (80 %/90 % height), so that the gesture matches the platform convention.
21. As an analyst, I want the drilldown header to show car number, class chip,
    manufacturer logo, team, and the rotating driver line-up, so that I can
    identify the entry without looking elsewhere.
22. As an analyst, I want a KPI strip with position, gap, laps, best lap,
    last lap, average lap, and stint count, so that I can summarise the entry
    in one glance.
23. As an analyst, I want a lap-time line chart with personal-best and
    stint-average reference lines, so that I can place each lap in context.
24. As an analyst, I want a sector matrix (laps × S1..Sn) coloured by status,
    so that I can locate where a fast or slow lap was won or lost.
25. As an analyst, I want a driver-stint timeline (horizontal bars showing
    which laps each driver drove), so that I can correlate pace changes with
    driver changes.
26. As an analyst, I want a compare-to-leader area chart of running gap, so
    that I can see whether the entry is gaining or losing ground.
27. As an analyst, I want a reserved telemetry placeholder block, so that the
    layout is forward-compatible with the planned telemetry feature.

### Track map (new)

28. As a spectator, I want a "Track Map" tab on desktop and tablet showing a
    schematic of the Nürburgring (Nordschleife + GP combination) with each
    sector colour-heated by current status, so that I can see where the
    fast/slow zones of the lap actually are.
29. As a mobile user, I want the existing Interactive Track Map screen to be
    accessible from the Stats tab on mobile, so that I do not lose this view
    on a small screen.

### State, errors, and i18n

30. As a spectator, I want a clear, German empty-state on
    `LTS_NOT_FOUND` ("Veranstaltung nicht gefunden"), so that I know the URL is
    wrong rather than the dashboard being broken.
31. As a spectator, I want a reconnecting banner during exponential-backoff,
    so that I know data is stale and recovering.
32. As a spectator, I want a connection-status dot in the header that maps to
    `connecting / open / reconnecting / closed / error`, so that I can read WS
    health at a glance.
33. As a German broadcast viewer, I want all UI labels in German by default,
    so that the dashboard matches the event language.
34. As an international viewer, I want a language toggle (DE / EN) in the
    Settings drawer/view, so that I can switch the UI to English.
35. As a spectator, I want the language choice to persist in the URL, so that
    I can share an English-language view with a non-German friend.

### Numeric formatting

36. As a spectator, I want all numeric data (lap times, gaps, sectors,
    deltas) rendered in a tabular monospace font with consistent decimal
    alignment, so that values are easy to compare row-to-row without visual
    jitter.
37. As a spectator, I want positive deltas in red and negative deltas in
    green, so that I can read direction at a glance.
38. As a spectator, I want lap-time values to keep three decimals and gaps to
    keep one decimal up to ±99.9 s, switching to lap notation beyond, so that
    formatting is consistent with motorsport conventions.

### Design system + design tokens

39. As a frontend developer, I want the Stitch named colors materialised as
    CSS custom properties in `src/index.css` and bound to shadcn's CSS
    variables, so that the existing shadcn components inherit the new theme
    without per-component edits.
40. As a frontend developer, I want JetBrains Mono loaded via a `<link>` in
    `index.html` and exposed as a Tailwind `font-mono` family, so that the
    `<DataNumeric>` primitive renders correctly without custom CSS.
41. As a frontend developer, I want a single `useBreakpoint()` hook returning
    `'mobile' | 'tablet' | 'desktop'`, so that no component has to repeat
    matchMedia logic.

### Settings + sharing

42. As a power user, I want the Settings drawer/view to expose: class filter,
    Pro/Am filter, column picker, language toggle, event id input, and a
    "copy share URL" button, so that all configuration lives in one place.
43. As a power user, I want the share URL to encode event id, config, active
    tab, language, class filter, and column choice, so that a shared link
    reproduces my exact view.

### Performance + acceptance

44. As an operator, I want desktop and mobile builds to score ≥ 90 in
    Lighthouse performance, so that the dashboard remains snappy on broadcast
    laptops and on phones over LTE.
45. As an operator, I want the dashboard to remain a static, zero-backend SPA
    after the redesign, so that I can keep deploying it to a CDN / GitHub
    Pages.

## Implementation Decisions

### Modules to build or modify

**New deep modules** (small, testable, stable interface):

- **Design tokens module.** A pure CSS-vars + Tailwind-config pair derived
  from the locked Stitch DS. Exposes semantic names (`--background`,
  `--surface-container-low`, `--primary`, `--positive`, `--hazard`,
  `--sector-session-best`, …). Shadcn variables are remapped onto these.
- **`<DataNumeric>` primitive.** Single React component that takes a value
  and a `kind` (`lapTime` | `sector` | `gap` | `delta` | `position` | `int`).
  Encapsulates monospace font, `tabular-nums`, decimal alignment, sign
  coloring, lap-notation switch. All numeric rendering in the app must go
  through this component.
- **`useBreakpoint()` hook.** Single hook returning
  `'mobile' | 'tablet' | 'desktop'`. Encapsulates `matchMedia`, SSR safety,
  and the Tailwind `md`/`lg` cutoffs. Replaces the current ad-hoc
  `useMediaQuery` calls in `App.tsx`.
- **`SectorCell` / `StatusChip` color map.** Pure mapping from the
  `decodeStatusCode` enum to a Tailwind class set. Lives next to the decoder
  so the wire-side enum and the view-side colors cannot drift.
- **Column visibility module.** Pure state that owns the column registry,
  defaults, hidden defaults, and the URL `cols=` round-trip. Exported as
  `useColumnVisibility()` plus a static `COLUMN_REGISTRY`.
- **`<TrackMap>`.** SVG schematic of the Nordschleife + GP-combination,
  with a sector index → corner-segment mapping, taking a status array and
  rendering a heat overlay.
- **`<DriverStintTimeline>`.** Pure derive `(LapHistory[]) → Stint[]` plus
  a horizontal-bar renderer.
- **`<LeaderDeltaChart>`.** Pure derive `(Snapshot[], carNumber) → GapPoint[]`
  plus a Recharts area chart.
- **i18n module.** Tiny dictionary lookup `t(key, vars)` over a DE / EN map.
  No third-party library; lookup only; missing-key fallback to the key itself.

**New shallow modules** (composition-only):

- **`<DashboardShell>`** — desktop/tablet shell composing
  `<SessionHeader>`, `<PodiumRibbon>`, `<MainTabs>`, and the active tab body.
- **`<MobileShell>`** — mobile shell composing `<SessionBar>`,
  `<MiniPodium>`, page slot, fixed `<BottomTabBar>`.
- **`<MainTabs>`** — Tabs primitive with conditional STQ trigger.
- **`<SettingsDrawer>` (desktop/tablet) and `<SettingsView>` (mobile)** —
  share the same form body (`<SettingsForm>`); only the chrome differs.
- **Connection state UI** — `<EmptyState>`, `<ErrorState>`,
  `<ReconnectingBanner>` reading the `connection` slice.

**Refactor / extend**:

- `App.tsx` — switch on `useBreakpoint()`, render `<DashboardShell>` or
  `<MobileShell>`, drop the current 3-column grid.
- `<Leaderboard>` — adopt the locked default columns; consume
  `useColumnVisibility()` for visibility state; use `<DataNumeric>` for all
  numerics; use the new `SectorCell`.
- `<CarDrilldownDialog>` — split into the seven content blocks listed in
  the User Stories, each exported individually so the tablet and mobile
  bottom sheets can re-compose them. New sub-components:
  `<DrilldownHeader>`, `<KpiStrip>`, `<LapTimeChart>` (existing, extended
  with PB + stint-avg refs), `<LapSectorMatrix>` (existing),
  `<DriverStintTimeline>` (new), `<LeaderDeltaChart>` (new),
  `<TelemetryPlaceholder>` (new). The dialog itself becomes a thin wrapper
  that picks centered-modal vs bottom-sheet based on `useBreakpoint()`.
- `<Podium>` — split into `<PodiumRibbon>` (slim, persistent, desktop +
  tablet) and `<MiniPodium>` (horizontal scroll, mobile).
- `<MessagesPanel>`, `<StatisticsPanel>`, `<TopQualifyingPanel>` — adopt
  new tokens; otherwise minimally invasive.
- `useUrlConfig` — extend with `cols`, `lang`, `tab` keys without breaking
  existing ones.

### Architecture and contracts

- **Layers stay**: Wire (`lib/ws.ts`, `lib/api.ts`) → Decode (`lib/decode.ts`)
  → Store (`store/useLiveStore.ts`) → View (`components/`). The redesign
  touches only View + a token layer below it.
- **No new state libraries.** Zustand and Tanstack-Query stay. New state
  (column visibility, language) lives in a Zustand slice rehydrated from URL
  by an extended `useSyncFiltersFromUrl`.
- **No CSS-in-JS.** Tokens via CSS custom properties; classes via Tailwind +
  shadcn variants.
- **No backend.** Static SPA stays. i18n is bundled at build time.
- **DE strings primary, EN secondary.** Strings ship in a single pair of dict
  files; missing key falls back to the key string.
- **Stitch is reference, not source.** We do not paste Stitch HTML. We extract
  the named colors and re-implement the layouts in JSX.

### Schema / API touch-points

- **URL schema additions** (backwards-compatible):
  `cols=<comma-separated-column-ids>`, `lang=<de|en>`, `tab=<leaderboard|stats|messages|trackmap|stq|settings>`.
- **Status enum** stays exactly as decoded by `decodeStatusCode`. No new
  values. The `SectorCell` color map is the single consumer.
- **No changes** to PIDs, decode shapes, or the WS open-frame.

### Specific interactions

- Tab switches do **not** unmount sibling tabs; the leaderboard keeps
  receiving updates while Stats is foreground.
- Drilldown is opened from any leaderboard row click; the breakpoint at
  the moment of click decides modal-vs-sheet for that session (re-evaluated
  on each open, not on resize).
- Reconnecting banner is non-blocking (top inset), not a toast.
- `LTS_NOT_FOUND` replaces the dashboard body with a centered empty state and
  a link back to the default event id.
- Bottom tab bar uses `position: sticky` plus
  `padding-bottom: env(safe-area-inset-bottom)`.

## Testing Decisions

A good test in this codebase exercises **external behaviour** (component
output for a given input, hook return value for a given URL/event) and avoids
asserting on internal state, class name lists, or DOM structure that is not
user-meaningful. Vitest + Testing-Library where the DOM is involved; pure
Vitest for the rest. Snapshot tests are reserved for full-screen Playwright
diffs and are explicitly opt-in.

**Modules with new tests** (per the answers given to the grilling round):

- **`<DataNumeric>`** — table tests across each `kind`
  (`lapTime`, `sector`, `gap`, `delta`, `position`, `int`):
  decimal alignment, lap-notation switchover at ±99.9 s, sign coloring for
  `delta`, locale-independent decimal separator, `null`/`undefined`/`NaN`
  handled as "—", monospace class always present.
- **`useBreakpoint()`** — JSDOM `matchMedia` mock; assert the three return
  values across the boundary widths (767, 768, 1023, 1024, 1280); SSR-safe
  initial render returns `'desktop'`; updates on resize via the registered
  listener.
- **`SectorCell` / `StatusChip` color map** — table test from each
  `decodeStatusCode` enum value to its expected token class. Add a guard test
  that fails the suite if a new enum value is added without a color mapping.
- **Column visibility module** — pure tests:
  default set matches PRD §3.4; hidden set matches PRD §3.4;
  `serializeCols(state) → string` and `parseCols(string) → state` round-trip;
  unknown column ids in URL are dropped silently; empty `cols=` resets to
  default.
- **`<DriverStintTimeline>` derive** — pure test: given a fixture
  `LapHistory[]` with driver changes, returns the expected `Stint[]` (driver,
  startLap, endLap, lapCount); handles 0-lap stints; handles unknown driver
  ids.
- **`<LeaderDeltaChart>` derive** — pure test: given a fixture snapshot
  sequence and a target car number, returns the expected `GapPoint[]` (lap,
  gapSeconds); handles laps where the leader car retired; clamps negative gaps
  (i.e. when the target unlapped) to 0 with a flag.
- **i18n** — pure tests: existing key returns DE/EN string; missing key
  returns the key; variable interpolation `t('foo.bar', {n: 3})`; switching
  language re-renders consumers (rendered with a tiny `<I18nProvider>`
  context).

**Existing PRD tests** (`lib/ws.ts`, `lib/decode.ts`, `hooks/useUrlConfig.ts`,
`store/useLiveStore.ts`) are kept and verified green; the `useUrlConfig`
suite gains cases for the new `cols`, `lang`, `tab` keys.

**Visual regression** (Playwright snapshots, two screens only, WS mocked via
fixture frames):

- Desktop dashboard at 1440×900 on the Leaderboard tab.
- Mobile leaderboard at 390×844.

**Prior art / inspiration**:

- The existing `decode.ts` test style (table tests over enum) is the model
  for `<DataNumeric>`, `SectorCell`, and i18n.
- Vitest fixture-driven tests (existing pattern) are the model for the
  derive functions in `<DriverStintTimeline>` and `<LeaderDeltaChart>`.

## Out of Scope

- Telemetry data integration (the placeholder block is rendered, but the
  data path is not wired).
- Audio commentary, push notifications, or any sound.
- Native mobile app — the mobile shell is responsive web only.
- Server-side rendering, SEO, social card previews.
- Authentication or user accounts.
- Recording or replaying full sessions in the browser.
- Localisation beyond DE / EN.
- Dark/light mode toggle — dark only.
- Other live-timing providers than `livetiming.azurewebsites.net`.
- Collaboration features (cursors, comments, "watch with friends").
- Backend or persistence layer — the app stays a static SPA.

## Further Notes

- The "complete concept" deliverable in Stitch is 17 screens (9 edits + 8
  new) inside project `projects/13661023061589856813`. The design system is
  already locked there; a developer should treat that project as the
  authoritative reference for tokens and screen layouts.
- The full delivery schedule (vertical phasing: foundations → desktop →
  tablet → mobile → tests + polish) lives in `docs/IMPLEMENTATION_PLAN.md`
  and is intentionally not duplicated here.
- The Telemetry placeholder is a deliberate forward-compat hook; do not
  delete it even though it ships empty. Removing it is a breaking layout
  change.
- Sector count is dynamic (Nordschleife uses up to 9, F1 tracks use 3); the
  leaderboard and sector matrix must render only the populated `S1..Sn`
  cells.
- `eventPid` remains an array (per PRD note) and is unaffected by this
  redesign.
- `LTS_TIMESYNC` ordering invariant from the original PRD is unchanged.
