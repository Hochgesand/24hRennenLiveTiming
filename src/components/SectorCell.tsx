import { cn } from "@/lib/utils"
import type { LapSectorStatus } from "@/domain"

const statusClass: Record<LapSectorStatus, string> = {
  sessionBest:
    "bg-violet-500/15 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100",
  personalBest:
    "bg-emerald-500/15 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100",
  pit: "bg-amber-500/20 text-amber-950 dark:bg-amber-500/25 dark:text-amber-100",
  inLap: "bg-muted/60 text-muted-foreground",
  outLap: "bg-muted/60 text-muted-foreground",
  normal: "bg-transparent",
}

export type SectorCellProps = {
  time: string
  status: LapSectorStatus
}

export function SectorCell({ time, status }: SectorCellProps) {
  return (
    <span
      className={cn(
        "inline-block min-w-[4.5rem] rounded px-1.5 py-0.5 text-right font-mono text-sm tabular-nums",
        statusClass[status],
      )}
    >
      {time}
    </span>
  )
}
