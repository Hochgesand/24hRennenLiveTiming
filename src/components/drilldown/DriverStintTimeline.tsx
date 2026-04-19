import type { Stint } from "@/lib/stintFromLaps"

type DriverStintTimelineProps = {
  stints: Stint[]
}

export function DriverStintTimeline({ stints }: DriverStintTimelineProps) {
  if (stints.length === 0) {
    return null
  }

  const minLap = Math.min(...stints.map((s) => s.startLap))
  const maxLap = Math.max(...stints.map((s) => s.endLap))
  const span = Math.max(1, maxLap - minLap + 1)

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Driver stints
      </div>
      <div className="flex h-10 w-full min-w-0 gap-0.5 overflow-hidden rounded-md border">
        {stints.map((s, i) => {
          const len = Math.max(1, s.endLap - s.startLap + 1)
          const pct = (len / span) * 100
          return (
            <div
              key={`${s.driver}-${s.startLap}-${i}`}
              className="bg-primary/25 hover:bg-primary/35 flex min-w-0 flex-col justify-center px-1.5 py-0.5 text-center transition-colors"
              style={{ width: `${pct}%` }}
              title={`${s.driver}: L${s.startLap}–L${s.endLap}`}
            >
              <span className="truncate text-[10px] leading-tight font-medium">{s.driver}</span>
            </div>
          )
        })}
      </div>
      <div className="text-muted-foreground flex justify-between font-mono text-[10px] tabular-nums">
        <span>L{minLap}</span>
        <span>L{maxLap}</span>
      </div>
    </div>
  )
}
