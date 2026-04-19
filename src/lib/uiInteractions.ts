/**
 * UI side-effect helpers shared across stats widgets.
 *
 * Keeping these as pure DOM functions (rather than React effects) lets the
 * heatmap call them from any event handler without prop-drilling refs through
 * the leading table. The trade-off is that callers depend on the structure
 * the leading table exposes via `data-testid="leading-row"` + `data-class`
 * — that contract is documented on `LeadingTable.tsx` (stories 26-31) and
 * tested via `SectorHeatmap.test.tsx`.
 */

/** CSS class applied to a leading-table row immediately after the jump. */
export const HIGHLIGHT_CLASS = "stats-row-highlight"

/** Wall-clock duration the highlight class stays on the matched row. */
const HIGHLIGHT_DURATION_MS = 1500

/**
 * Escape `value` for safe inclusion in a double-quoted attribute selector.
 *
 * Prefers the standard `CSS.escape` (which handles every CSS identifier edge
 * case) and falls back to escaping the only characters that can actually
 * break a quoted attribute value (`"` and `\`). The fallback path matters
 * for jsdom, which historically doesn't expose the `CSS` global.
 */
function escapeAttrValue(value: string): string {
  if (
    typeof CSS !== "undefined" &&
    typeof (CSS as { escape?: (s: string) => string }).escape === "function"
  ) {
    return CSS.escape(value)
  }
  return value.replace(/(["\\])/g, "\\$1")
}

/**
 * Scroll the `LeadingTable` row that matches `classLabel` into view, then
 * apply {@link HIGHLIGHT_CLASS} for {@link HIGHLIGHT_DURATION_MS}.
 *
 * No-ops when:
 * - we're outside a browser context (SSR, jsdom without a `document`),
 * - no `[data-testid="leading-row"][data-class="…"]` element matches.
 *
 * `prefers-reduced-motion` switches `behavior` from `"smooth"` to `"auto"`
 * (instant) so the page jump respects the user's accessibility setting.
 *
 * Special characters in `classLabel` (hyphens, dots, brackets — e.g. `SP-X`,
 * `4WD-2.0`) are normalised via `CSS.escape` so the attribute selector is
 * always syntactically valid.
 */
export function scrollToLeadingClass(classLabel: string): void {
  if (typeof document === "undefined") return
  const safe = escapeAttrValue(classLabel)
  const row = document.querySelector<HTMLElement>(
    `[data-testid="leading-row"][data-class="${safe}"]`
  )
  if (!row) return
  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  row.scrollIntoView({
    behavior: reduced ? "auto" : "smooth",
    block: "center",
  })
  row.classList.add(HIGHLIGHT_CLASS)
  window.setTimeout(() => {
    row.classList.remove(HIGHLIGHT_CLASS)
  }, HIGHLIGHT_DURATION_MS)
}
