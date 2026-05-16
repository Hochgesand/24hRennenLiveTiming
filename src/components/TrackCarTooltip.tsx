import { forwardRef } from "react"

import type { TrackDriverMarker } from "@/lib/trackTiming"
import { useI18n } from "@/i18n/I18nContext"
import { TOOLTIP_W } from "@/lib/trackTooltipAnchor"

/** Pre-computed screen position for the tooltip box (CSS left/top). */
export interface TrackTooltipAnchor {
  /** CSS left in pixels (edge-flipped, clamped). */
  left: number
  /** CSS top in pixels (edge-flipped, clamped). */
  top: number
}

export const TrackCarTooltip = forwardRef<
  HTMLDivElement,
  { driver: TrackDriverMarker; anchor: TrackTooltipAnchor }
>(function TrackCarTooltip({ driver, anchor }, ref) {
  const { t } = useI18n()

  return (
    <div
      ref={ref}
      role="tooltip"
      aria-live="polite"
      className="border-border bg-card/95 text-foreground pointer-events-none absolute z-10 flex flex-col gap-1 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
      style={{
        left: `${anchor.left}px`,
        top: `${anchor.top}px`,
        width: `${TOOLTIP_W}px`,
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-bold tabular-nums">
          #{driver.startingNumber}
        </span>
        <span className="truncate text-sm font-semibold">
          {driver.name || driver.team || "—"}
        </span>
      </div>
      <div className="border-border/60 border-t pt-1 font-mono text-[11px] leading-snug tabular-nums">
        <div>
          P{driver.position || "—"}
          {driver.classPosition != null && driver.className ? (
            <> · {driver.className} P{driver.classPosition}</>
          ) : null}
        </div>
        {driver.gapToLeader ? (
          <div className="text-muted-foreground">
            {t("trackmap.tooltip.gapPrefix")} {driver.gapToLeader}
          </div>
        ) : null}
        {driver.laps != null ? (
          <div className="text-muted-foreground">
            {t("trackmap.tooltip.lapPrefix")} {driver.laps}
          </div>
        ) : null}
      </div>
    </div>
  )
})
