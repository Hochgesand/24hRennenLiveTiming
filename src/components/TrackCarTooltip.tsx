import { forwardRef } from "react"

import type { TrackDriverMarker } from "@/lib/trackTiming"
import { useI18n } from "@/i18n/I18nContext"

export interface TrackTooltipAnchor {
  /** Pixel x within the parent container. */
  x: number
  /** Pixel y within the parent container. */
  y: number
  /** Width of the parent container (px) — used for edge flipping. */
  containerW: number
  /** Height of the parent container (px) — used for edge flipping. */
  containerH: number
}

const TOOLTIP_W = 210
const TOOLTIP_H = 100
const OFFSET = 14

export const TrackCarTooltip = forwardRef<
  HTMLDivElement,
  { driver: TrackDriverMarker; anchor: TrackTooltipAnchor }
>(function TrackCarTooltip({ driver, anchor }, ref) {
  const { t } = useI18n()

  const flipX = anchor.x + OFFSET + TOOLTIP_W > anchor.containerW
  const flipY = anchor.y + OFFSET + TOOLTIP_H > anchor.containerH
  const left = Math.max(2, flipX ? anchor.x - TOOLTIP_W - OFFSET : anchor.x + OFFSET)
  const top = Math.max(2, flipY ? anchor.y - TOOLTIP_H - OFFSET : anchor.y + OFFSET)

  return (
    <div
      ref={ref}
      role="tooltip"
      aria-live="polite"
      className="border-border bg-card/95 text-foreground pointer-events-none absolute z-10 flex flex-col gap-1 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur-sm"
      style={{
        left: `${left}px`,
        top: `${top}px`,
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
