# Implementation Plan — 24h Live Timing Dashboard

> Companion to `PRD.md`. Locks down design + delivery decisions captured during the
> "complete concept" grilling session. All Stitch designs live in the project
> **Nürburgring 24h Live Timing** (Stitch project id `13661023061589856813`).

---

## 0. TL;DR

- Concept = 12 Stitch screens covering Desktop / Tablet / Mobile, all sharing one DS ("Telemetric Cockpit", red `#E30613`, Space Grotesk + Inter, `ROUND_FOUR`).
- Architecture stays per PRD: Wire → Decode → Store → View. No backend.
- Desktop is **tabbed full-bleed** with a persistent header carrying session info, track state, and a slim podium ribbon.
- Tablet (1024) mirrors the desktop tab pattern but compact, drilldown opens as a bottom sheet.
- Mobile (390) uses a **bottom tab bar** with 4 tabs (Race / Stats / Messages / Settings), drilldown also a bottom sheet.
- Implementation phasing: vertical — desktop first end-to-end, then tablet, then mobile.
- Code path from Stitch: extract tokens to `globals.css`, hand-write JSX matching layout. We do **not** paste Stitch HTML directly.
- DE labels primary, EN via i18n in code.
- Tests: keep PRD unit tests (ws / decode / store / urlconfig) + Playwright snapshot for desktop main and mobile leaderboard.

---

## 1. Design system (locked)

| Field | Value |
|-------|-------|
| Stitch project | `projects/13661023061589856813` ("Nürburgring 24h Live Timing") |
| North star | Telemetric Cockpit |
| Color mode | Dark |
| Primary | `#E30613` (Nürburgring red) |
| Secondary | `#009639` (race green, positive delta) |
| Tertiary | `#FF8000` (hazard orange, caution) |
| Surface base | `#121314` |
| Headline font | Space Grotesk |
| Body font | Inter |
| Mono (data) | JetBrains Mono / Geist Mono (code-side, not in Stitch enum) |
| Roundness | `ROUND_FOUR` (sharp, technical) |
| Spacing scale | 1 (compact) |

Token export step (see §6) materialises the named colors into `src/index.css` via CSS custom properties so shadcn picks them up.

---

## 2. Screen inventory (locked)

### Existing in Stitch project (will be edited, see §5)

| ID | Title | Device | New role |
|----|-------|--------|----------|
| `c24460e2ffd048bbac164ea14d4be742` | Desktop Timing Dashboard | DESKTOP 1280 | Main dashboard, tabbed full-bleed, **Leaderboard tab** |
| `7a3eb1c4ded04f9cbfb72cfdce995fca` | Tablet Timing Dashboard (mislabeled DESKTOP 2560) | DESKTOP | Re-tagged TABLET, regenerated 1024×1366 portrait, same tab pattern |
| `648a1f5d02c644a581786f7affd5ff5a` | Driver Detail Modal | DESKTOP | Refined Car Drilldown overlay (full block set) |
| `61fac2a41e7b4c15b80fb7d5521b2361` | Mobile Timing App | MOBILE 390 | Mobile **Race** tab (Leaderboard) — bottom tab bar |
| `64f171608ce745daa3a7d6a808e302b2` | Overall Leaderboard | MOBILE 390 | Becomes mobile **Class filter view** |
| `b93cfa49d5e34d6da7fbc113221b4f61` | SP9 Class Standings | MOBILE 390 | Becomes mobile **Stats tab** (best laps, sectors, class winners) |
| `7a3e4dc256d340a4b51d83a6bb89c112` | Car Detail: #911 Grello | MOBILE 390 | Mobile drilldown bottom sheet (real Manthey entry) |
| `938bb92c0eb64772aec96013e9466313` | Interactive Track Map | MOBILE 390 | Track Map / Sector heatmap view (also basis for desktop tab) |
| `756986e36bfa45a7a0d99a1e1228c0b7` | PRD doc | DOCUMENT | Untouched |

### New screens to generate

| # | Title | Device | Notes |
|---|-------|--------|-------|
| N1 | Desktop Race Messages tab | DESKTOP 1440×900 | Same chrome, full-width messages feed + filters |
| N2 | Desktop Statistics tab | DESKTOP 1440×900 | Best lap, best sector grid, class winners, fastest in class |
| N3 | Desktop Top Qualifying (STQ) | DESKTOP 1440×900 | Pro / ProAm split, only when STQ active |
| N4 | Desktop Track Map / Sector heatmap | DESKTOP 1440×900 | SVG track schematic + per-sector heat |
| N5 | Tablet portrait main dashboard | TABLET 1024×1366 | Same tabs, denser, drilldown as bottom sheet |
| N6 | Tablet portrait drilldown sheet | TABLET 1024×1366 | Full sheet with KPIs + lap chart + sector matrix |
| N7 | Mobile Settings tab | MOBILE 390×844 | Filters, columns, language toggle, event id, share URL |
| N8 | Connection / Empty / Error state | DESKTOP 1440×900 | Reconnecting + `LTS_NOT_FOUND` + skeleton placeholder |

**Total deliverable: 9 edits + 8 new = 17 Stitch screens** (covers the original "12" plus a couple of necessary state variants).

### Non-goals for Stitch (handled in code only)

- Live skeleton shimmer animations
- Connection status toast
- Browser title / favicon updates

---

## 3. Layout decisions (locked)

### 3.1 Desktop — Tabbed full-bleed

```
┌──────────────────────────────────────────────────────────────┐
│ Header: Event title │ Session timer │ Track state │ WS dot   │
├──────────────────────────────────────────────────────────────┤
│ Podium ribbon (top 3 cards, slim, persistent across tabs)    │
├──────────────────────────────────────────────────────────────┤
│ Tabs: [Leaderboard] [Stats] [Messages] [Track Map] [STQ?]    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   <Active tab content, full-bleed, max density>              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- STQ tab is conditionally rendered only when the session has `STQ` data.
- Drilldown opens as a centered modal, not a tab.
- Settings/filter drawer slides from the right, triggered by gear icon in header.

### 3.2 Tablet 1024 portrait — Same tabs, compact

- Identical tab structure as desktop.
- Podium ribbon collapses to 2 lines on first scroll.
- Drilldown opens as a bottom sheet (full width, 80% height).

### 3.3 Mobile 390 — Bottom tab bar

```
┌──────────────────────┐
│ Compact session bar  │
├──────────────────────┤
│ Mini podium (top 3,  │
│ horizontal scroll)   │
├──────────────────────┤
│                      │
│   Tab content        │
│                      │
├──────────────────────┤
│ [Race][Stats][Msgs]  │
│ [Settings]           │
└──────────────────────┘
```

- Bottom tab bar is the primary nav.
- Drilldown opens as a bottom sheet (90% height) with handle.
- Filter / column controls live inside Settings tab.

### 3.4 Default visible columns (PRD US #8)

Default leaderboard columns:
`Pos | # | Class chip | Driver+Team stack | Gap | Last | Fastest | S1..Sn cells`.

Hidden by default (opt-in via column picker):
`Car (manufacturer) | Pit count | Stint length | Tire compound | Best of class`.

---

## 4. Drilldown content blocks (PRD US #12–15)

In order, top to bottom, both desktop modal and tablet/mobile sheets:

1. **Header** — car #, class chip, manufacturer logo, team, driver line-up.
2. **KPI strip** — position, gap, laps, best lap, last lap, avg lap, stints.
3. **Lap-time line chart** — Recharts line, with PB and stint-avg reference lines.
4. **Sector matrix** — lap rows × `S1..Sn`, heat-coloured by status enum.
5. **Driver-stint timeline** — horizontal bar showing who drove which laps.
6. **Compare-to-leader delta chart** — area chart of running gap to leader.
7. **Telemetry placeholder** — empty state for future expansion (PRD out-of-scope but reserved).

---

## 5. Stitch operations plan

Run in this order (parallelisable within each wave):

### Wave A — Token enforcement + DS doc (1 op)

Skip if DS already matches §1 — already does. No-op.

### Wave B — Edit existing screens (5 ops)

1. **Edit `c24460e2…` (Desktop Timing Dashboard)** → tabbed full-bleed, persistent podium ribbon, real ADAC entries (#911 Manthey EMA, #98 ROWE, #4 HRT, #44 Falken, etc.), German labels.
2. **Edit `7a3eb1c4…`** → re-cast as tablet portrait 1024×1366, same tab pattern, drilldown bottom-sheet.
3. **Edit `648a1f5d…` (Driver Detail Modal)** → all 7 drilldown blocks, real #911 Grello data.
4. **Edit `61fac2a4…` (Mobile Timing App)** → bottom tab bar with 4 tabs, Race tab active.
5. **Edit `7a3e4dc2…` (Car Detail #911)** → mobile drilldown sheet variant of the desktop modal.

### Wave C — Generate new screens (8 ops)

N1–N8 from §2 table. Each gets a self-contained prompt that re-states the locked DS + layout rules so Stitch keeps consistency.

### Wave D — Visual diff QA

After all screens render: pull screenshots, eyeball for podium-ribbon alignment, header chrome consistency, podium colours, sector cell legibility.

---

## 6. Code implementation plan (vertical phasing)

### Phase 0 — Foundations (1 day)

- Extract Stitch named colors → CSS custom properties in `src/index.css` (`--background`, `--surface-container-low`, etc.). Map shadcn vars to these.
- Add JetBrains Mono via `<link>` in `index.html` for the data class.
- Define a `<DataNumeric>` primitive that applies `font-mono tabular-nums` and right-alignment.
- Define `<StatusChip>`, `<SectorCell>` colour map matching `decodeStatusCode` enum.
- Add `useBreakpoint` returning `'mobile' | 'tablet' | 'desktop'` (Tailwind `md`/`lg` cutoffs).

### Phase 1 — Desktop end-to-end (3–4 days)

In order:

1. Refactor `App.tsx` so desktop branch renders `<DashboardShell>` with persistent `<SessionHeader>`, `<PodiumRibbon>`, `<MainTabs>`. Existing `<Tabs>` only appear on mobile branch.
2. Build `<MainTabs>` with `Tabs` component holding `Leaderboard | Stats | Messages | TrackMap | STQ?` triggers. STQ trigger conditionally visible from store.
3. Refactor `<Leaderboard>` with the locked default columns and the column picker (in Settings drawer). Persist column choice in URL via existing `useUrlConfig` (extend keys: `cols=`).
4. Build `<TrackMap>` view (SVG of Nordschleife sector boundaries, heat-coloured by `sessionBest|personalBest|...`).
5. Build `<SettingsDrawer>` (Radix `Dialog` from the right) with class filter, Pro/Am, column picker, language, event id, copy-share-URL button.
6. Refactor `<CarDrilldownDialog>` to render all 7 blocks per §4. Sub-components: `<DrilldownHeader>`, `<KpiStrip>`, `<LapTimeChart>` (already exists, extend with PB + stint-avg refs), `<LapSectorMatrix>` (already exists), `<DriverStintTimeline>` (new), `<LeaderDeltaChart>` (new), `<TelemetryPlaceholder>` (new).
7. Wire connection / error / empty states to a `<DashboardShell>` overlay component using sonner for toasts and a centered `<EmptyState>` for `LTS_NOT_FOUND`.

### Phase 2 — Tablet end-to-end (1–2 days)

1. `useBreakpoint() === 'tablet'` branch reuses `<DashboardShell>` but with denser cells and drilldown via a `<Sheet side="bottom">`.
2. Podium ribbon becomes a 2-row carousel.
3. Hide column picker; reduce defaults.

### Phase 3 — Mobile end-to-end (2–3 days)

1. Mobile branch renders `<MobileShell>` with compact `<SessionBar>`, `<MiniPodium>`, page slot, fixed `<BottomTabBar>`.
2. Tabs: Race (current `<Leaderboard>` mobile variant), Stats (`<StatisticsPanel>`), Messages (`<MessagesPanel>`), Settings (`<SettingsView>`).
3. Drilldown reuses the tablet bottom sheet with 90% height.
4. Add safe-area padding (`env(safe-area-inset-bottom)`).

### Phase 4 — Tests + polish (1–2 days)

1. Existing PRD tests (`lib/ws.ts`, `lib/decode.ts`, `hooks/useUrlConfig.ts`, `store/useLiveStore.ts`) — check and complete.
2. Playwright snapshots: desktop dashboard at 1440×900, mobile leaderboard at 390×844. Run with WS mocked via fixture frames.
3. Lighthouse pass (mobile + desktop), target ≥ 90 perf.

---

## 7. Real ADAC 24h Nürburgring entries used in mocks

| # | Team | Car | Drivers (rotating) | Class |
|---|------|-----|-------------------|-------|
| 911 | Manthey EMA | Porsche 911 GT3 R | Lietz / Olsen / Müller / Pilet | SP9 Pro |
| 98 | ROWE Racing | BMW M4 GT3 | van der Linde / Yelloly / Catsburg | SP9 Pro |
| 4 | Mercedes-AMG Team HRT | Mercedes-AMG GT3 | Asch / Engel / Stolz / Marciello | SP9 Pro |
| 44 | Falken Motorsports | Porsche 911 GT3 R | Picariello / Bachler / Werner / Ragginger | SP9 Pro |
| 1 | Schubert Motorsport | BMW M4 GT3 | De Phillippi / Eng / Krohn / Wittmann | SP9 Pro |
| 18 | KCMG | Porsche 911 GT3 R | Bohn / Ten Voorde / Yamashita / Vautier | SP9 Pro |
| 34 | Walkenhorst Motorsport | BMW M4 GT3 | Buus / Krütten / Karjalainen / Lindholm | SP9 Pro |
| 16 | Scherer Sport PHX | Audi R8 LMS GT3 evo II | Mies / Niederhauser / van der Linde | SP9 Pro |
| 6 | Phoenix Racing | Audi R8 LMS GT3 evo II | TBA | SP9 ProAm |

Lap time band: 8:05.xxx – 8:25.xxx (Nordschleife full GP+24h layout). Sector splits roughly 1:35 / 1:55 / 1:50 / 1:25 / 1:20 / 0:55 / 0:30 (varies per session). Sector count = 9 max for Nordschleife (PRD note).

---

## 8. Risks & open questions

- **Stitch fidelity drift:** Stitch may regenerate layouts that drift from §3. Mitigation: use `edit_screens` with explicit prompts referencing this file's §3 each time.
- **Tablet 2560×2048 legacy screen** — current "Tablet Timing Dashboard" is desktop-sized. Wave B step 2 corrects this.
- **STQ data shape** — PRD references PID 501 but no fixture yet. Build with synthetic data, validate when first STQ session runs.
- **WS Origin / CORS for REST `/laps-data`** — PRD flags need to verify. Track in #wire.
- **Recharts vs Chart.js** — PRD says Recharts. Stick with that.

---

## 9. Acceptance checklist

- [ ] All 17 Stitch screens exist and are visible at https://stitch.withgoogle.com (or wherever)
- [ ] DS tokens mirrored to `src/index.css`
- [ ] Desktop renders tabbed full-bleed shell with persistent podium ribbon
- [ ] Tablet renders same tab pattern, drilldown is bottom sheet
- [ ] Mobile renders bottom tab bar, 4 tabs
- [ ] Drilldown contains all 7 blocks
- [ ] PRD US #1–28 each map to at least one rendered screen
- [ ] Connection error → `LTS_NOT_FOUND` shows German "Veranstaltung nicht gefunden" empty state
- [ ] Vitest suite green
- [ ] Playwright snapshots for desktop + mobile green
- [ ] Lighthouse perf ≥ 90 on `npm run build && npm run preview`
