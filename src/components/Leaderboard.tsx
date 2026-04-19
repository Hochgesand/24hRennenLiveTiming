import { ArrowDown, ArrowUp } from "lucide-react"

import { parseChg } from "@/lib/chg"
import { decodeLapStatus } from "@/domain"
import { sectorColumnKey } from "@/lib/leaderboardColumns"
import {
  computeMaxSectors,
  filterLeaderboardRowsByExclusions,
  sortLeaderboardRows,
} from "@/lib/leaderboard"
import type { RawResultRow } from "@/domain"
import { cn } from "@/lib/utils"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"

import { DataNumeric } from "./DataNumeric"
import { LeaderboardFilters } from "./LeaderboardFilters"
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

function timeCell(row: RawResultRow, key: keyof RawResultRow): string {
  return cell(row[key])
}

/** First non-empty trimmed string from wire keys (defensive aliases). */
function wireStr(row: RawResultRow, ...keys: string[]): string {
  for (const k of keys) {
    const s = str(row[k])
    if (s) {
      return s
    }
  }
  return ""
}

function positionCellAriaLabel(row: RawResultRow): string {
  const posLabel = str(row.POSITION) || "unknown"
  const chg = parseChg(row.CHG)
  if (chg === null) {
    return `Position ${posLabel}`
  }
  if (chg === 0) {
    return `Position ${posLabel}, no position change`
  }
  if (chg > 0) {
    const p = chg === 1 ? "place" : "places"
    return `Position ${posLabel}, up ${chg} ${p}`
  }
  const d = Math.abs(chg)
  const p = d === 1 ? "place" : "places"
  return `Position ${posLabel}, down ${d} ${p}`
}

function PositionChgVisual({ chg }: { chg: number | null }) {
  if (chg === null || chg === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  const up = chg > 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        up ? "text-[#9ddf2e]" : "text-[#fb7185]"
      )}
    >
      {up ? <ArrowUp className="size-3.5 shrink-0" aria-hidden /> : <ArrowDown className="size-3.5 shrink-0" aria-hidden />}
      {Math.abs(chg)}
    </span>
  )
}

export function Leaderboard() {
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const setSelectedStartingNo = useUiStore((s) => s.setSelectedStartingNo)
  const excludedClasses = useFilterStore((s) => s.excludedClasses)
  const excludedProams = useFilterStore((s) => s.excludedProams)
  const excludedColumns = useFilterStore((s) => s.excludedColumns)
  const results = sessionMeta?.RESULT

  if (!sessionMeta?.RESULT?.length) {
    return (
      <div
        className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm"
        role="status"
      >
        No leaderboard data
      </div>
    )
  }

  const colHidden = (key: string) => excludedColumns.has(key.toLowerCase())

  const sorted = sortLeaderboardRows(results)
  const rows = filterLeaderboardRowsByExclusions(sorted, excludedClasses, excludedProams)
  const maxSectors = computeMaxSectors(rows)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <LeaderboardFilters sourceRows={sorted} maxSectors={maxSectors} />
      <div className="overflow-auto rounded-xl border border-white/[0.08] bg-[#1c2025]">
        <table className="w-full text-sm">
          <thead className="bg-muted/95 sticky top-0 z-10 backdrop-blur">
            <tr className="text-muted-foreground border-b text-left">
              {!colHidden("pos") ? (
                <th className="px-3 py-2 font-medium">Pos</th>
              ) : null}
              {!colHidden("num") ? (
                <th className="px-3 py-2 font-medium">#</th>
              ) : null}
              {!colHidden("class") ? (
                <th className="px-3 py-2 font-medium">Class</th>
              ) : null}
              {!colHidden("driver") ? (
                <th className="px-3 py-2 font-medium">Driver</th>
              ) : null}
              {!colHidden("team") ? (
                <th className="px-3 py-2 font-medium">Team</th>
              ) : null}
              {!colHidden("car") ? (
                <th className="px-3 py-2 font-medium">Car</th>
              ) : null}
              {!colHidden("pit") ? (
                <th className="px-3 py-2 text-right font-medium">Pit</th>
              ) : null}
              {!colHidden("stint") ? (
                <th className="px-3 py-2 font-medium">Stint</th>
              ) : null}
              {!colHidden("tire") ? (
                <th className="px-3 py-2 font-medium">Tire</th>
              ) : null}
              {!colHidden("bestclass") ? (
                <th className="px-3 py-2 font-medium">Best class</th>
              ) : null}
              {!colHidden("gap") ? (
                <th className="px-3 py-2 text-right font-medium">Gap</th>
              ) : null}
              {!colHidden("last") ? (
                <th className="px-3 py-2 text-right font-medium">Last</th>
              ) : null}
              {!colHidden("fast") ? (
                <th className="px-3 py-2 text-right font-medium">Fastest</th>
              ) : null}
              {maxSectors > 0
                ? Array.from({ length: maxSectors }, (_, i) => {
                    const n = i + 1
                    const sk = sectorColumnKey(n)
                    if (colHidden(sk)) {
                      return null
                    }
                    return (
                      <th
                        key={`S${n}`}
                        className="px-3 py-2 text-right font-medium"
                      >
                        S{n}
                      </th>
                    )
                  })
                : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const team = str(row.TEAM)
              const car = str(row.CAR)
              const stnr = str(row.STNR)
              const rowInteractive = stnr !== ""
              const openRow = () => {
                if (rowInteractive) {
                  setSelectedStartingNo(stnr)
                }
              }
              return (
                <tr
                  key={i}
                  tabIndex={rowInteractive ? 0 : undefined}
                  className={cn(
                    "even:bg-muted/30 hover:bg-muted/50 border-b border-border/60 last:border-0",
                    rowInteractive && "cursor-pointer"
                  )}
                  onClick={rowInteractive ? openRow : undefined}
                  onKeyDown={
                    rowInteractive
                      ? (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            openRow()
                          }
                        }
                      : undefined
                  }
                  aria-label={
                    rowInteractive
                      ? `Open lap details for ${str(row.NAME) || "driver"}, number ${stnr}`
                      : undefined
                  }
                >
                  {!colHidden("pos") ? (
                    <td
                      className="px-3 py-1.5 tabular-nums"
                      aria-label={positionCellAriaLabel(row)}
                    >
                      <span className="inline-flex items-center gap-2" aria-hidden="true">
                        <span>{cell(row.POSITION)}</span>
                        <PositionChgVisual chg={parseChg(row.CHG)} />
                      </span>
                    </td>
                  ) : null}
                  {!colHidden("num") ? (
                    <td className="px-3 py-1.5 tabular-nums">{cell(row.STNR)}</td>
                  ) : null}
                  {!colHidden("class") ? (
                    <td className="px-3 py-1.5">{cell(row.CLASSNAME)}</td>
                  ) : null}
                  {!colHidden("driver") ? (
                    <td className="px-3 py-1.5">
                      {!colHidden("team") ? (
                        cell(row.NAME)
                      ) : (
                        <div className="flex max-w-[14rem] flex-col gap-0.5">
                          <span className="truncate">{cell(row.NAME)}</span>
                          {team ? (
                            <span
                              className="text-muted-foreground truncate text-xs"
                              title={team}
                            >
                              {team}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>
                  ) : null}
                  {!colHidden("team") ? (
                    <td
                      className="max-w-[8rem] truncate px-3 py-1.5"
                      title={team || undefined}
                    >
                      {cell(row.TEAM)}
                    </td>
                  ) : null}
                  {!colHidden("car") ? (
                    <td
                      className="max-w-[8rem] truncate px-3 py-1.5"
                      title={car || undefined}
                    >
                      {cell(row.CAR)}
                    </td>
                  ) : null}
                  {!colHidden("pit") ? (
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {cell(wireStr(row, "PITCNT", "PITCOUNT"))}
                    </td>
                  ) : null}
                  {!colHidden("stint") ? (
                    <td className="px-3 py-1.5">{cell(wireStr(row, "STINT"))}</td>
                  ) : null}
                  {!colHidden("tire") ? (
                    <td className="px-3 py-1.5">{cell(wireStr(row, "TIRE"))}</td>
                  ) : null}
                  {!colHidden("bestclass") ? (
                    <td className="px-3 py-1.5">{cell(wireStr(row, "BOFC", "BESTCLASS"))}</td>
                  ) : null}
                  {!colHidden("gap") ? (
                    <td className="px-3 py-1.5 text-right">
                      <DataNumeric value={row.GAP} kind="gap" />
                    </td>
                  ) : null}
                  {!colHidden("last") ? (
                    <td className="px-3 py-1.5 text-right">
                      <SectorCell status={decodeLapStatus(row.LLTS)}>
                        <DataNumeric value={row.LASTLAPTIME} kind="lapTime" />
                      </SectorCell>
                    </td>
                  ) : null}
                  {!colHidden("fast") ? (
                    <td className="px-3 py-1.5 text-right">
                      <DataNumeric
                        value={(wireStr(row, "FASTESTLAP", "FLTS") || row.FASTESTLAP) ?? row.FLTS}
                        kind="lapTime"
                      />
                    </td>
                  ) : null}
                  {maxSectors > 0
                    ? Array.from({ length: maxSectors }, (_, i) => {
                        const n = i + 1
                        const sk = sectorColumnKey(n)
                        if (colHidden(sk)) {
                          return null
                        }
                        const timeKey = `S${n}TIME` as keyof RawResultRow
                        const statusKey = `ST${n}T` as keyof RawResultRow
                        return (
                          <td key={`s-${n}`} className="px-3 py-1.5 text-right">
                            <SectorCell
                              time={timeCell(row, timeKey)}
                              status={decodeLapStatus(row[statusKey])}
                            />
                          </td>
                        )
                      })
                    : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
