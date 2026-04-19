import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { AverageMode, LapChartPoint } from "@/lib/lapTimes"
import {
  averageModeLabel,
  formatLapSeconds,
  personalBestSeconds,
  resolveAverageSeconds,
} from "@/lib/lapTimes"

const PB_STROKE = "#059669"
const AVG_STROKE = "#64748b"
/** Theme chart color (defined in `index.css` as `--chart-1`). */
const LINE_STROKE = "var(--chart-1)"

type LapTimeChartProps = {
  points: LapChartPoint[]
  averageMode: AverageMode
}

export function LapTimeChart({ points, averageMode }: LapTimeChartProps) {
  const pb = personalBestSeconds(points)
  const avg = resolveAverageSeconds(points, averageMode)
  const chartData = points.map((p) => ({
    lap: p.lap,
    seconds: p.seconds,
    lapTimeLabel: p.lapTimeLabel,
  }))

  const avgLegend =
    averageMode === "off"
      ? null
      : `${averageModeLabel(averageMode)} (${avg != null ? formatLapSeconds(avg) : "—"})`

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-0.5 w-8 rounded-full" style={{ background: PB_STROKE }} />
          PB {pb != null ? formatLapSeconds(pb) : "—"}
        </span>
        {averageMode !== "off" ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-8 rounded-full border-0 border-dashed bg-transparent"
              style={{
                background: `repeating-linear-gradient(90deg, ${AVG_STROKE}, ${AVG_STROKE} 4px, transparent 4px, transparent 7px)`,
                height: 2,
              }}
            />
            {avgLegend}
          </span>
        ) : (
          <span className="text-muted-foreground/80">Average line hidden (select below)</span>
        )}
      </div>

      <div className="h-[min(360px,50vh)] w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="lap"
              tick={{ fontSize: 11 }}
              tickLine={false}
              label={{ value: "Lap", position: "insideBottom", offset: -2, fontSize: 11 }}
            />
            <YAxis
              dataKey="seconds"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => formatLapSeconds(Number(v))}
              width={68}
              label={{
                value: "Time",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11 },
              }}
            />
            <Tooltip
              formatter={(value, _name, item) => {
                const payload = item?.payload as { lapTimeLabel?: string } | undefined
                const label = payload?.lapTimeLabel
                if (value === undefined || value === null) {
                  return ["—", label ? `Lap time (${label})` : "Lap time"]
                }
                return [
                  typeof value === "number" ? formatLapSeconds(value) : String(value),
                  label ? `Lap time (${label})` : "Lap time",
                ]
              }}
              labelFormatter={(lap) => `Lap ${lap}`}
            />
            {pb != null ? (
              <ReferenceLine
                y={pb}
                stroke={PB_STROKE}
                strokeWidth={2}
                label={{
                  value: `PB ${formatLapSeconds(pb)}`,
                  position: "insideTopRight",
                  fill: PB_STROKE,
                  fontSize: 11,
                }}
              />
            ) : null}
            {avg != null && averageMode !== "off" ? (
              <ReferenceLine
                y={avg}
                stroke={AVG_STROKE}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                label={{
                  value: `${averageModeLabel(averageMode)} ${formatLapSeconds(avg)}`,
                  position: "insideBottomRight",
                  fill: AVG_STROKE,
                  fontSize: 11,
                }}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="seconds"
              name="Lap time"
              stroke={LINE_STROKE}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
