import type { ReactNode } from "react"

import type {
  StatisticsBestLapRow,
  StatisticsBestSectorRow,
  StatisticsLeadingRow,
} from "@/domain"
import { cn } from "@/lib/utils"
import { useLiveStore } from "@/store/useLiveStore"

function str(v: unknown): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

function cell(v: unknown): string {
  const s = str(v)
  return s || "—"
}

function asRows<T extends Record<string, unknown>>(arr: unknown): T[] {
  if (!Array.isArray(arr)) {
    return []
  }
  return arr.filter(
    (x): x is T => x !== null && typeof x === "object" && !Array.isArray(x),
  ) as T[]
}

function hasSectorValue(row: StatisticsBestSectorRow, n: number): boolean {
  const key = `S${n}` as keyof StatisticsBestSectorRow
  return str(row[key]) !== ""
}

function maxSectorColumns(rows: StatisticsBestSectorRow[]): number {
  let max = 0
  for (let n = 1; n <= 9; n++) {
    if (rows.some((r) => hasSectorValue(r, n))) {
      max = n
    }
  }
  return max
}

function StatBlock({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "border-border/80 bg-card/30 rounded-lg border px-2 py-2",
        className,
      )}
    >
      <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  )
}

export function StatisticsPanel() {
  const statistics = useLiveStore((s) => s.statistics)

  const leading = asRows<StatisticsLeadingRow>(statistics?.LEADING)
  const bestLaps = asRows<StatisticsBestLapRow>(statistics?.BESTLAPS)
  const bestSectors = asRows<StatisticsBestSectorRow>(statistics?.BESTSECTORS)

  const hasAny =
    leading.length > 0 || bestLaps.length > 0 || bestSectors.length > 0
  const maxS = maxSectorColumns(bestSectors)

  return (
    <section
      aria-label="Session statistics"
      className="border-border flex shrink-0 flex-col rounded-xl border"
    >
      <h2 className="text-muted-foreground border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide">
        Statistics
      </h2>
      <div className="flex flex-col gap-3 p-3">
        {!hasAny ? (
          <p
            className="text-muted-foreground text-center text-sm"
            role="status"
          >
            No statistics
          </p>
        ) : (
          <>
            {leading.length > 0 ? (
              <StatBlock title="Leading">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs tabular-nums">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left">
                        <th className="pb-1 pr-2 font-medium">Class</th>
                        <th className="pb-1 pr-2 font-medium">#</th>
                        <th className="pb-1 pr-2 font-medium">Laps</th>
                        <th className="pb-1 font-medium">Sum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leading.map((row, i) => (
                        <tr
                          key={`l-${i}-${cell(row.CLASS)}-${cell(row.NR)}`}
                          className="border-border/60 border-b last:border-b-0"
                        >
                          <td className="py-1 pr-2">{cell(row.CLASS)}</td>
                          <td className="py-1 pr-2 font-mono">{cell(row.NR)}</td>
                          <td className="py-1 pr-2">{cell(row.LAPS)}</td>
                          <td className="font-mono py-1">{cell(row.SUM)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </StatBlock>
            ) : null}

            {bestLaps.length > 0 ? (
              <StatBlock title="Best laps">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs tabular-nums">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left">
                        <th className="pb-1 pr-2 font-medium">Class</th>
                        <th className="pb-1 font-medium">Lap time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bestLaps.map((row, i) => (
                        <tr
                          key={`b-${i}-${cell(row.CLASS)}-${cell(row.NR)}`}
                          className="border-border/60 border-b last:border-b-0"
                        >
                          <td className="py-1 pr-2">{cell(row.CLASS)}</td>
                          <td className="font-mono py-1">{cell(row.LAPTIME)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </StatBlock>
            ) : null}

            {bestSectors.length > 0 ? (
              <StatBlock title="Best sectors">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs tabular-nums">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left">
                        <th className="pb-1 pr-2 font-medium">Class</th>
                        {maxS > 0
                          ? Array.from({ length: maxS }, (_, j) => (
                              <th
                                key={`sh-${j}`}
                                className="pb-1 px-0.5 font-medium"
                              >
                                S{j + 1}
                              </th>
                            ))
                          : null}
                      </tr>
                    </thead>
                    <tbody>
                      {bestSectors.map((row, i) => (
                        <tr
                          key={`s-${i}-${cell(row.CLASS)}`}
                          className="border-border/60 border-b last:border-b-0"
                        >
                          <td className="py-1 pr-2">{cell(row.CLASS)}</td>
                          {maxS > 0
                            ? Array.from({ length: maxS }, (_, j) => {
                                const key =
                                  `S${j + 1}` as keyof StatisticsBestSectorRow
                                return (
                                  <td
                                    key={key}
                                    className="font-mono px-0.5 py-1 whitespace-nowrap"
                                  >
                                    {cell(row[key])}
                                  </td>
                                )
                              })
                            : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </StatBlock>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
