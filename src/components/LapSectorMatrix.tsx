import { SectorCell } from "@/components/SectorCell"
import { decodeLapStatus, type WireScalar } from "@/domain"
import {
  hasPerSectorSplits,
  lapNumberLabel,
  type RawLapRow,
  sectorSplitCell,
} from "@/lib/lapExport"

const SECTOR_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

type LapSectorMatrixProps = {
  laps: RawLapRow[]
}

function sectorStatus(row: RawLapRow, n: number) {
  const key = `ST${n}T`
  if (!(key in row)) {
    return undefined
  }
  return decodeLapStatus(row[key] as WireScalar | undefined)
}

export function LapSectorMatrix({ laps }: LapSectorMatrixProps) {
  if (laps.length === 0) {
    return null
  }

  if (!hasPerSectorSplits(laps)) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Sector splits not available in lap export
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[32rem] text-xs">
        <thead className="bg-muted/80">
          <tr className="text-muted-foreground border-b text-left">
            <th className="sticky left-0 z-[1] bg-muted/95 px-2 py-1.5 font-medium backdrop-blur">
              Lap
            </th>
            {SECTOR_INDICES.map((n) => (
              <th key={n} className="px-1.5 py-1.5 font-medium tabular-nums">
                S{n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {laps.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="text-muted-foreground sticky left-0 z-[1] bg-background px-2 py-1 font-medium tabular-nums">
                {lapNumberLabel(row, i)}
              </td>
              {SECTOR_INDICES.map((n) => {
                const v = sectorSplitCell(row, n)
                const st = sectorStatus(row, n)
                return (
                  <td key={n} className="px-1.5 py-1 tabular-nums">
                    {st !== undefined ? (
                      <SectorCell time={v || "—"} status={st} />
                    ) : (
                      v || "—"
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
