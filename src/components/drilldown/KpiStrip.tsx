import type { RawResultRow } from "@/domain"
import type { LapChartPoint } from "@/lib/lapTimes"
import { formatLapSeconds, personalBestSeconds, stintAverageSeconds } from "@/lib/lapTimes"

function str(v: unknown): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

export type KpiStripProps = {
  row: RawResultRow | undefined
  series: LapChartPoint[] | null | undefined
}

export function KpiStrip({ row, series }: KpiStripProps) {
  const pos = str(row?.POSITION) || "—"
  const gap = str(row?.GAP) || "—"
  const lapsField = row?.LAPS
  const laps =
    lapsField !== undefined && lapsField !== null && str(lapsField) !== ""
      ? str(lapsField)
      : null

  const pb = series && series.length > 0 ? personalBestSeconds(series) : null
  const last =
    series && series.length > 0 ? series[series.length - 1]!.lapTimeLabel : null
  const avg = series && series.length > 0 ? stintAverageSeconds(series) : null

  const items: { label: string; value: string }[] = [
    { label: "Pos", value: pos },
    { label: "Gap", value: gap },
    ...(laps !== null ? [{ label: "Laps", value: laps }] : []),
    { label: "Fastest", value: pb != null ? formatLapSeconds(pb) : "—" },
    { label: "Last", value: last ?? "—" },
    { label: "Average", value: avg != null ? formatLapSeconds(avg) : "—" },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="bg-muted/40 border-border rounded-md border px-2 py-1.5 text-xs"
        >
          <div className="text-muted-foreground mb-0.5 font-medium tracking-wide uppercase">
            {label}
          </div>
          <div className="font-mono text-sm leading-tight tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  )
}
