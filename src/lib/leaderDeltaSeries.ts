import type { LapChartPoint } from "@/lib/lapTimes"

export type GapPoint = { lap: number; gapSeconds: number }

/**
 * Per-lap gap to leader in seconds: `car.seconds - leader.seconds`, negative clamped to 0.
 */
export function gapSeriesToLeader(
  carPoints: LapChartPoint[],
  leaderPoints: LapChartPoint[] | null,
): GapPoint[] {
  if (!leaderPoints || leaderPoints.length === 0 || carPoints.length === 0) {
    return []
  }

  const byLap = new Map<number, number>()
  for (const p of leaderPoints) {
    byLap.set(p.lap, p.seconds)
  }

  const out: GapPoint[] = []
  for (const p of carPoints) {
    const ls = byLap.get(p.lap)
    if (ls === undefined) {
      continue
    }
    const raw = p.seconds - ls
    out.push({
      lap: p.lap,
      gapSeconds: raw < 0 ? 0 : raw,
    })
  }
  return out
}
