import { ArrowDown, ArrowUp } from "lucide-react"

import { parseChg } from "@/lib/chg"
import { getPodiumRows } from "@/lib/podium"
import type { RawResultRow } from "@/domain"
import { useLiveStore } from "@/store/useLiveStore"
import { cn } from "@/lib/utils"

function str(v: unknown): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

function isLeaderGap(gap: unknown): boolean {
  if (gap === undefined || gap === null || gap === "") {
    return true
  }
  const n = typeof gap === "number" ? gap : Number(String(gap).trim())
  return Number.isFinite(n) && n === 0
}

function gapLabel(row: RawResultRow, place: 1 | 2 | 3): string {
  const g = row.GAP
  if (place === 1) {
    return isLeaderGap(g) ? "Leader" : str(g) || "—"
  }
  return str(g) || "—"
}

function ChgIndicator({ row }: { row: RawResultRow }) {
  const chg = parseChg(row.CHG)
  if (chg === null || chg === 0) {
    return null
  }
  const up = chg > 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums",
        up ? "text-[var(--chg-positive)]" : "text-[var(--chg-negative)]"
      )}
      title={`Δ ${chg > 0 ? "+" : ""}${chg}`}
    >
      {up ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />}
      {Math.abs(chg)}
    </span>
  )
}

function RibbonCard({
  row,
  place,
  dense,
}: {
  row: RawResultRow
  place: 1 | 2 | 3
  dense?: boolean
}) {
  const name = str(row.NAME) || "—"
  const team = str(row.TEAM)
  const car = str(row.CAR)

  return (
    <div
      className={cn(
        "border-border bg-card flex min-w-0 max-w-[10rem] flex-1 flex-col rounded-lg border px-2.5 py-2",
        dense && "max-w-[9rem] px-2 py-1.5",
        place === 1 && "border-amber-400/35 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1.5">
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
            place === 1 && "bg-amber-500/20 text-amber-800 dark:text-amber-200",
            place === 2 && "bg-slate-400/20 text-slate-800 dark:text-slate-200",
            place === 3 && "bg-amber-900/15 text-amber-950 dark:text-amber-100"
          )}
        >
          P{place}
        </span>
        <ChgIndicator row={row} />
      </div>
      <p
        className={cn("truncate font-semibold leading-tight", dense ? "text-[11px]" : "text-xs")}
        title={name}
      >
        {name}
      </p>
      {team ? (
        <p
          className={cn(
            "text-muted-foreground truncate leading-tight",
            dense ? "text-[9px]" : "text-[10px]",
          )}
          title={team}
        >
          {team}
        </p>
      ) : null}
      <p
        className={cn(
          "text-muted-foreground truncate font-mono",
          dense ? "text-[9px]" : "text-[10px]",
        )}
        title={car || undefined}
      >
        {car || "—"}
      </p>
      <p
        className={cn(
          "text-muted-foreground mt-0.5 font-mono tabular-nums",
          dense ? "text-[9px]" : "text-[10px]",
        )}
      >
        {gapLabel(row, place)}
      </p>
    </div>
  )
}

export type PodiumRibbonProps = {
  /** Tablet: after scrolling the tab panel, switch to a 2-row layout (PRD §3.2). */
  twoRowCompact?: boolean
}

export function PodiumRibbon({ twoRowCompact = false }: PodiumRibbonProps) {
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const results = sessionMeta?.RESULT

  if (!sessionMeta || !results?.length) {
    return null
  }

  const [p1, p2, p3] = getPodiumRows(results)
  if (!p1 && !p2 && !p3) {
    return null
  }

  const dense = twoRowCompact

  if (twoRowCompact) {
    return (
      <section
        className="border-border shrink-0 border-b px-3 py-2 sm:px-4"
        aria-label="Podium top three"
      >
        <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2">
          <div className="flex justify-end">
            {p2 ? <RibbonCard row={p2} place={2} dense={dense} /> : <div />}
          </div>
          <div className="flex justify-start">
            {p1 ? <RibbonCard row={p1} place={1} dense={dense} /> : null}
          </div>
          <div className="col-span-2 flex justify-center">
            {p3 ? <RibbonCard row={p3} place={3} dense={dense} /> : null}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section
      className="border-border flex shrink-0 items-stretch justify-center gap-2 border-b px-3 py-2 sm:gap-3 sm:px-4"
      aria-label="Podium top three"
    >
      <div className="flex min-w-0 flex-1 justify-end sm:max-w-[11rem]">
        {p2 ? <RibbonCard row={p2} place={2} /> : <div className="flex-1" />}
      </div>
      <div className="flex min-w-0 justify-center sm:max-w-[11rem]">
        {p1 ? <RibbonCard row={p1} place={1} /> : null}
      </div>
      <div className="flex min-w-0 flex-1 justify-start sm:max-w-[11rem]">
        {p3 ? <RibbonCard row={p3} place={3} /> : <div className="flex-1" />}
      </div>
    </section>
  )
}
