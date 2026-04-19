import { decodeLapStatus, type RawTopQualifyingRow } from "@/domain"
import { useLiveStore } from "@/store/useLiveStore"

import { SectorCell } from "./SectorCell"

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

function asTopQualRows(arr: unknown): RawTopQualifyingRow[] {
  if (!Array.isArray(arr)) {
    return []
  }
  return arr.filter((x): x is RawTopQualifyingRow => x != null && typeof x === "object")
}

function ValCell({ row }: { row: RawTopQualifyingRow }) {
  const time = cell(row.VAL)
  const status = decodeLapStatus(row.ST)
  return <SectorCell time={time} status={status} />
}

function TopQualifyingTable({
  title,
  rows,
}: {
  title: string
  rows: RawTopQualifyingRow[]
}) {
  return (
    <div className="min-w-0 flex-1 overflow-auto rounded-lg border">
      <table className="w-full text-xs">
        <caption className="bg-muted/80 border-b px-2 py-1.5 text-left text-[0.7rem] font-semibold tracking-wide">
          {title}
        </caption>
        <thead className="bg-muted/60">
          <tr className="text-muted-foreground border-b text-left">
            <th className="px-2 py-1 font-medium">#</th>
            <th className="px-2 py-1 font-medium">Name</th>
            <th className="px-2 py-1 font-medium">Car</th>
            <th className="px-2 py-1 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="text-muted-foreground px-2 py-2" colSpan={4}>
                No data
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className="even:bg-muted/25 hover:bg-muted/40 border-border/60 border-b last:border-0"
              >
                <td className="px-2 py-1 tabular-nums">{cell(row.STNR)}</td>
                <td className="max-w-[9rem] truncate px-2 py-1" title={str(row.NAME) || undefined}>
                  {cell(row.NAME)}
                </td>
                <td
                  className="max-w-[7rem] truncate px-2 py-1 font-mono"
                  title={str(row.CAR) || undefined}
                >
                  {cell(row.CAR)}
                </td>
                <td className="px-2 py-1 text-right">
                  <ValCell row={row} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function TopQualifyingPanel() {
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const topQualifying = useLiveStore((s) => s.topQualifying)

  const stqActive = Boolean(sessionMeta?.STQ)
  if (!stqActive) {
    return null
  }

  const proRows = asTopQualRows(topQualifying?.PRO)
  const proAmRows = asTopQualRows(topQualifying?.PROAM)

  return (
    <section
      className="border-border flex flex-col gap-3 border-b px-4 py-3"
      aria-label="Top qualifying"
    >
      <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Top qualifying
      </h2>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch">
        <TopQualifyingTable title="Pro" rows={proRows} />
        <TopQualifyingTable title="Pro-Am" rows={proAmRows} />
      </div>
    </section>
  )
}
