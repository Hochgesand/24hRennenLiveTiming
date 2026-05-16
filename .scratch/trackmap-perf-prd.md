## Problem Statement

When a user opens the Streckenkarte (track-map) tab during a live race with a
full field (130+ cars), the browser tab becomes unresponsive. Frames stutter,
hover and click feel laggy, and tooling that requires a screenshot of the page
times out after 30 s. Other browser timers (`setInterval`) barely fire because
the render thread is saturated.

This was introduced by the recent rewrite of the panel: the per-frame
`requestAnimationFrame` tick triggers a full React re-render that recomputes
the marker list, re-runs the position projection, calls
`SVGGeometryElement.getPointAtLength` for every visible car, and re-attaches
fresh `onPointerEnter` / `onPointerLeave` / `onClick` handlers to every
marker `<g>`. With ~130 markers this is hundreds of attribute writes and
listener swaps every animation frame, plus React reconciliation cost.

The new pure-velocity-integration timing model behaves correctly (the unit
tests and the captured-fixture replay both pass), but the panel that consumes
it spends its frame budget on React work instead of on letting the browser
paint.

## Solution

The track map should keep up with a full Nordschleife/GP field — at least
150 visible cars on a mid-range laptop — without locking up the renderer,
while preserving every behaviour the rewrite introduced: smooth measured-
velocity motion, indefinite coasting on stale data, the rich race-state
tooltip on hover, and the wheel/drag/pinch/keyboard/follow-car viewport.

To achieve that, the panel must move the per-frame work out of React's
reconciliation path. React stays in charge of state changes that genuinely
need a re-render (a car enters or leaves the track; the user hovers, clicks
follow, drags, zooms), while everything that changes every frame (marker
positions, follow-car viewport translation, tooltip pin to a moving marker)
becomes a direct DOM write inside a single `requestAnimationFrame` loop.

## User Stories

1. As a race engineer watching live timing, I want the track map to update the position of every car ~30–60 times per second, so that motion looks continuous and not stepped.
2. As a race engineer, I want the track-map tab to stay responsive when the full 24 h field (130+ cars) is on track, so that I can interact with it without input lag.
3. As a race engineer, I want to hover any car and see the rich tooltip appear instantly, so that I don't have to wait for the renderer to catch up.
4. As a race engineer, I want the hover tooltip to stay pinned to the car as it moves around the track, so that I can read it while the car is in motion.
5. As a race engineer, I want to click a car to lock the viewport onto it, so that I can follow a specific battle without manually panning.
6. As a race engineer, I want the followed car to remain centred at all zoom levels and to keep updating smoothly even at high zoom, so that following works at any detail level.
7. As a race engineer, I want to release the follow lock (Escape, the "Following #N ×" chip, the 1:1 reset, or by dragging) and have the viewport stay where the car last was, so that the release does not visually jump.
8. As a race engineer, I want to mouse-wheel-zoom, drag-to-pan, and use keyboard shortcuts (`+`, `-`, `0`, arrow keys) while the field is in motion, so that all viewport interactions stay smooth.
9. As a race engineer on a tablet, I want pinch-to-zoom to work on the track map under the same conditions, so that the mobile experience is not degraded.
10. As a race engineer, I want the per-car SVG position to never visibly jump between consecutive frames (excluding pit-out / sector-skip safety snaps), so that motion stays smooth at all times.
11. As a race engineer, I want the panel to keep advancing markers at their last known speed when the live-timing WebSocket pauses for seconds at a time, so that the visualisation does not freeze.
12. As a race engineer, I want the panel to stop wasting CPU when no markers are moving (e.g. session over, all cars in pit), so that an idle tab does not run my fan.
13. As a developer maintaining the track map, I want the per-frame animation logic to live behind a focused, testable hook, so that I can change motion behaviour without re-reading the entire panel.
14. As a developer, I want the viewport state machine (zoom, pan, pinch, follow, release) to be testable in isolation from the SVG, so that pan/zoom regressions are caught without spinning up a real DOM.
15. As a developer, I want the screen-space anchor math (SVG-coords → container pixels, edge flipping) to be a pure function with unit tests, so that the tooltip positioning behaviour is locked in.
16. As a developer, I want the marker layer to re-render only when the set of visible STNRs changes, so that React reconciliation cost is proportional to actual UI structure changes, not animation frames.
17. As an automated UI-verification tool (Playwright, the Claude Preview MCP server, etc.), I want the page to remain capturable while the track map is open, so that screenshots and DOM snapshots complete in a reasonable time.

## Implementation Decisions

### Module decomposition

The panel is decomposed into four focused pieces. The rAF animation work
and the viewport state machine are pulled out as deep modules behind narrow
interfaces; the marker layer becomes a thin React component whose only job
is to render a stable element per STNR.

1. **`useTrackMarkerAnimation` hook** — owns the `requestAnimationFrame`
   loop. On each tick it calls `computeTrackDrivers`, walks the result,
   and (a) writes a `transform="translate(x y)"` attribute directly to the
   `<g>` element associated with each visible STNR via a shared marker-ref
   map, (b) maintains a positions ref and a drivers ref used by the
   viewport hook and the tooltip, (c) sets the visible-STNR list as React
   state only when the set membership changes. The hook is self-contained
   and never reads from React's render output between frames.

2. **`useViewportController` hook** — owns viewport state (`scale`, `tx`,
   `ty`, `followStnr`). Exposes pointer / wheel / keyboard handlers,
   `zoomBy`, `setFollow`, `releaseFollow`, and a derived effective
   transform string. When `followStnr` is set, the rAF loop writes the
   effective transform directly to the SVG element via a ref; React only
   re-renders viewport-dependent UI (zoom %, follow chip) on actual state
   transitions. `releaseFollow` commits the current visual transform back
   to plain viewport state so release never jumps.

3. **`MarkerLayer` component** — receives a list of visible STNRs plus a
   marker-ref-assigner function from the animation hook, and renders one
   `<g data-stnr>` per car. It memoizes purely on the STNR set. Pointer
   handlers are attached **once** at the layer level and use event
   delegation (`event.target.closest('[data-stnr]')`) to identify the
   marker. There are no per-marker listeners and no per-frame React
   reconciliation.

4. **`trackTooltipAnchor` pure utility** — given marker SVG coordinates,
   the effective viewport, and the container size, returns the screen-
   space `{x, y}` for the tooltip plus the edge-flipped final
   `{left, top}`. The rAF loop calls this every frame for the hovered
   marker and writes the result directly to the tooltip element's style.

### Architectural points

- The deep `trackTiming` module (pure-velocity-integration projector,
  per-car history, sector-measured speed, 5 s velocity blend, indefinite
  coasting, 1 500 m safety snap) is unchanged. The performance fix lives
  entirely above it.
- All per-frame work happens in exactly one `requestAnimationFrame`
  callback. There is no `setAnimTick` state-bumping loop.
- React renders the marker layer at most once per visibility change. In a
  steady race state with no pit-ins/outs, this can be tens of seconds
  apart.
- The single delegated pointer handler on the marker layer replaces the
  prior per-marker `onPointerEnter`/`onPointerLeave`/`onClick` triplet.
  Hover state changes still flow through React because the tooltip is a
  rendered component.
- The animation hook auto-pauses (does not schedule the next rAF) when
  there are zero visible markers, so an idle tab does not run hot.
- The viewport state machine separates user-driven viewport (state) from
  follow-derived viewport (computed). `releaseFollow` is the bridge
  between them and is the only place where the visual position is copied
  back into stored state.

## Testing Decisions

Good tests here exercise the **observable behaviour** of each extracted
module — what the user, the DOM, or a calling component sees — not the
exact sequence of internal calls or which ref was updated when.

- **`useViewportController` hook tests** (Vitest, jsdom): drive the hook
  through realistic input sequences (wheel + drag + pinch + key + click-
  to-follow + Escape) and assert the resulting `(scale, tx, ty,
  followStnr)` state after each step. Prior art: the existing pure-logic
  tests in `src/lib/trackTiming.test.ts` and `src/lib/trackGeometry.test.ts`
  — they treat the module as a black box with seeded inputs.

- **`trackTooltipAnchor` utility tests** (Vitest): pure function, no DOM.
  Cover the cardinal cases — anchor inside container, anchor near right
  edge (flips left), near bottom edge (flips up), follow-mode override.

- **No tests for the rAF animation hook itself.** jsdom does not provide
  layout-correct `SVGPathElement.getTotalLength` / `getPointAtLength`, and
  faking `requestAnimationFrame` to assert "the hook called setAttribute
  with the right transform" tests implementation details, not behaviour.
  Correctness of the position output is already covered by the captured-
  fixture replay test in `src/lib/__fixtures__/trackTiming.captured.test.ts`,
  which exercises the same projector through realistic data.

- **No tests for `MarkerLayer` in isolation.** The component is a thin
  rendering shell whose interesting behaviour (event delegation, ref
  assignment) is already validated by the animation hook tests through
  observed marker positions.

- **No screenshot-based regression test** for the performance fix itself.
  The pass criterion is qualitative ("the panel stays responsive with the
  full field") and is verified manually using the Claude Preview MCP
  server: navigate to `?event=50&tab=trackmap`, attempt a screenshot,
  confirm it returns within 5 s, and confirm a `setInterval(250 ms, 20
  samples)` collects all 20 samples within ~6 s.

## Plan

### Phase 1 — Extract pure modules first

1. Add `trackTooltipAnchor` (pure utility) and its tests. Replace the
   inline anchor math in the panel with the utility. Land this first; it
   has no behaviour change.

2. Add `useViewportController` hook and its tests. The hook owns viewport
   + follow state and exposes handlers. Wire the panel to use the hook;
   behaviour unchanged.

### Phase 2 — Decouple animation from React reconciliation

3. Add `useTrackMarkerAnimation` hook. The hook accepts geometry /
   timing-sectors / path element / history / a marker-ref-assigner
   function. It runs a single rAF loop, mutates positions / drivers refs,
   calls `setAttribute('transform', ...)` per marker, and only updates
   the visible-STNR state when the set changes. It also writes the
   effective transform onto the SVG element when follow mode is active.
   The hook stops scheduling rAFs when there are no visible markers and
   resumes when there are again.

4. Add `MarkerLayer` component. Renders a `<g data-stnr>` per visible
   STNR with the marker-ref-assigner. Pointer handlers attached once at
   the layer using event delegation. Includes hover/follow visual
   variants (radius, fill colour).

5. Strip the panel down to: static SVG layers, the `MarkerLayer` call,
   the `TrackCarTooltip` render, and the two hooks. Remove `setAnimTick`,
   per-marker handlers, and inline animation code.

### Phase 3 — Verify

6. Run the full test suite. Run the captured-fixture replay
   (`npm run replay:trackmap`) — must still report `0` jumps > 40 SVG
   units. Run lint and the production build.

7. Manual verification in the Claude Preview MCP server with
   `?event=50&tab=trackmap`:
   - Screenshot returns within 5 s with 130+ visible markers.
   - `setInterval(250 ms, 20 samples)` of a leader marker's `cx`/`cy`
     completes within ~6 s and shows monotonic movement.
   - Hover a marker → rich tooltip appears immediately and stays pinned
     to the marker as it moves.
   - Click a marker → viewport locks; Escape / × chip releases without
     jumping; drag releases follow and continues pan smoothly.
   - Wheel zoom and `+/-/0` keyboard shortcuts respond within a frame.

## Out of Scope

- Changes to the per-car timing model (`trackTiming.ts`). The pure-
  velocity-integration projector, the class-average bootstrap, the 5 s
  blend, and the 1 500 m drift safety snap are all unchanged.
- Replacing the WIGE 70 m overlap separation.
- Replacing the SVG track asset (`nuerburgring24h.ts`).
- A speed/sector-time read-out on the marker itself.
- A rich tooltip that shows current pace / km/h / current sector — the
  rewrite keeps the existing minimal race-state tooltip (number, driver,
  P overall, P in class, gap, lap).
- A WebGL or Canvas rendering backend — the fix stays inside the existing
  SVG-with-imperative-attribute-writes approach.
- Optimising the static SVG track layers (sector heat overlays, labels,
  arrows) — those re-render only on session changes, not per frame, and
  are not the bottleneck.

## Further Notes

- The current working tree contains an in-progress refactor of the panel
  that already moves some animation work to refs and introduces
  `forwardRef` on `TrackCarTooltip`. That work should be reverted or
  rebuilt against the cleaner module structure described here, so the
  change history reads as a single well-decomposed PR rather than two
  attempts.
- The performance bottleneck was discovered when the Claude Preview MCP
  server's `preview_screenshot` consistently timed out after 30 s on the
  trackmap tab while `preview_eval` returned within milliseconds — a
  reliable signature of renderer saturation without main-thread JS hang.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
