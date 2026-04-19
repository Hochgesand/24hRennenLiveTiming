import { cn } from "@/lib/utils"
import type { LapSectorStatus } from "@/domain"

const statusClass: Record<LapSectorStatus, string> = {
  sessionBest:
    "bg-[#22d3ee]/15 text-[#a5f3fc] ring-1 ring-[#22d3ee]/25",
  personalBest: "bg-[#9ddf2e]/15 text-[#d9f99d] ring-1 ring-[#9ddf2e]/20",
  pit: "bg-[#f59e0b]/20 text-amber-100 ring-1 ring-[#f59e0b]/25",
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
