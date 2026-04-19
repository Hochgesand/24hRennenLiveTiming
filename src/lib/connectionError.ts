/**
 * Connection-error helpers shared between `App.tsx`, `AppShellRouter.tsx`, and
 * `App.test.tsx`. Lives in its own module so `react-refresh/only-export-components`
 * stays happy with `App.tsx`.
 *
 * The WIGE live-timing WebSocket emits `{ PID: "LTS_NOT_FOUND" }` when the
 * subscribed event id is unknown. `src/lib/ws.ts` surfaces that as the literal
 * string `"event not found"` on `connection.error`. App.tsx uses this helper
 * to route the whole tree to `<EventNotFoundOverlay>` before `<AppShellRouter>`
 * mounts, so the Statistik tab's skeleton never masks the connection error
 * (PRD-statistics-cockpit.md §"Empty / loading / error states" item 2).
 */
export function isEventNotFoundError(error: string | null): boolean {
  return error !== null && error.trim().toLowerCase() === "event not found"
}
