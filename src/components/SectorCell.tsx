import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { LapSectorStatus } from "@/domain"

const statusClass: Record<LapSectorStatus, string> = {
  sessionBest:
    "bg-[var(--sector-session)]/18 text-[var(--sector-session-fg)] ring-1 ring-[var(--sector-session)]/30",
  overallBest:
    "bg-[var(--sector-overall)]/18 text-[var(--sector-overall-fg)] ring-1 ring-[var(--sector-overall)]/30",
  personalBest:
    "bg-[var(--sector-personal)]/18 text-[var(--sector-personal-fg)] ring-1 ring-[var(--sector-personal)]/25",
  pit: "bg-[var(--sector-pit)]/22 text-amber-100 ring-1 ring-[var(--sector-pit)]/30",
  inLap: "bg-muted/60 text-muted-foreground",
  outLap: "bg-muted/60 text-muted-foreground",
  invalid: "bg-destructive/15 text-destructive ring-1 ring-destructive/25",
  normal: "bg-transparent",
}

export type SectorCellProps = {
  /** Plain lap/sector time text (used when `children` is omitted). */
  time?: string
  status: LapSectorStatus
  /** When set (e.g. {@link DataNumeric}), overrides `time`. */
  children?: ReactNode
}

export function SectorCell({ time, status, children }: SectorCellProps) {
  const content = children ?? time ?? "—"
  return (
    <span
      className={cn(
        "inline-block min-w-[4.5rem] rounded px-1.5 py-0.5 text-right font-mono text-sm tabular-nums",
        statusClass[status],
      )}
    >
      {content}
    </span>
  )
}
