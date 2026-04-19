import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import type { GapPoint } from "@/lib/leaderDeltaSeries"

const AREA_FILL = "var(--chart-2)"

type LeaderDeltaChartProps = {
  points: GapPoint[]
}

function formatGap(sec: number): string {
  if (!Number.isFinite(sec)) {
    return "—"
  }
  const sign = sec > 0 ? "+" : ""
  return `${sign}${sec.toFixed(3)}s`
}

export function LeaderDeltaChart({ points }: LeaderDeltaChartProps) {
  if (points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        No overlapping laps vs leader for gap chart.
      </p>
    )
  }

  const data = points.map((p) => ({
    lap: p.lap,
    gapSeconds: p.gapSeconds,
  }))

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Gap to leader
      </div>
      <div className="h-[min(240px,40vh)] w-full min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="lap"
              tick={{ fontSize: 11 }}
              tickLine={false}
              label={{ value: "Lap", position: "insideBottom", offset: -2, fontSize: 11 }}
            />
            <YAxis
              dataKey="gapSeconds"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
              width={52}
              label={{
                value: "Gap",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11 },
              }}
            />
            <Tooltip
              formatter={(value) => [
                typeof value === "number" ? formatGap(value) : String(value),
                "Gap",
              ]}
              labelFormatter={(lap) => `Lap ${lap}`}
            />
            <Area
              type="monotone"
              dataKey="gapSeconds"
              name="Gap"
              stroke={AREA_FILL}
              fill={AREA_FILL}
              fillOpacity={0.25}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
