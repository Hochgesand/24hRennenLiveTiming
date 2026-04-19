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
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        up ? "text-[#9ddf2e]" : "text-[#fb7185]"
      )}
      title={`Δ ${chg > 0 ? "+" : ""}${chg}`}
    >
      {up ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
      {Math.abs(chg)}
    </span>
  )
}

function PodiumCard({
  row,
  place,
  elevated,
}: {
  row: RawResultRow
  place: 1 | 2 | 3
  elevated: boolean
}) {
  const name = str(row.NAME) || "—"
  const team = str(row.TEAM)
  const car = str(row.CAR)

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-[11rem] flex-1 flex-col rounded-xl border border-white/[0.08] bg-[#1c2025] px-3 py-3",
        elevated
          ? "scale-105 border-amber-400/45 shadow-[0_0_28px_rgba(34,211,238,0.14)] md:min-h-[9.5rem]"
          : "border-white/10 scale-100 md:min-h-[8rem]"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
            place === 1 && "bg-amber-500/20 text-amber-800 dark:text-amber-200",
            place === 2 && "bg-slate-400/20 text-slate-800 dark:text-slate-200",
            place === 3 && "bg-amber-900/15 text-amber-950 dark:text-amber-100"
          )}
        >
          P{place}
        </span>
        <ChgIndicator row={row} />
      </div>
      <p className="truncate text-sm font-semibold leading-tight" title={name}>
        {name}
      </p>
      {team ? (
        <p className="text-muted-foreground truncate text-xs leading-tight" title={team}>
          {team}
        </p>
      ) : null}
      <p className="text-muted-foreground mt-1 truncate font-mono text-xs" title={car || undefined}>
        {car || "—"}
      </p>
      <p className="text-muted-foreground mt-auto pt-2 font-mono text-xs tabular-nums">
        {gapLabel(row, place)}
      </p>
    </div>
  )
}

export function Podium() {
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const results = sessionMeta?.RESULT

  if (!sessionMeta || !results?.length) {
    return null
  }

  const [p1, p2, p3] = getPodiumRows(results)

  if (!p1 && !p2 && !p3) {
    return null
  }

  return (
    <section
      className="border-border flex flex-col items-stretch gap-4 border-b px-4 py-4 sm:flex-row sm:items-end sm:justify-center sm:gap-4"
      aria-label="Podium top three"
    >
      <div className="order-2 flex justify-center sm:order-1 sm:flex-1 sm:justify-end">
        {p2 ? <PodiumCard row={p2} place={2} elevated={false} /> : null}
      </div>
      <div className="order-1 flex justify-center sm:order-2">
        {p1 ? <PodiumCard row={p1} place={1} elevated /> : null}
      </div>
      <div className="order-3 flex justify-center sm:flex-1 sm:justify-start">
        {p3 ? <PodiumCard row={p3} place={3} elevated={false} /> : null}
      </div>
    </section>
  )
}
