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
    return isLeaderGap(g) ? "L" : str(g) || "—"
  }
  return str(g) || "—"
}

function ChgMini({ row }: { row: RawResultRow }) {
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
    >
      {up ? <ArrowUp className="size-2.5" aria-hidden /> : <ArrowDown className="size-2.5" aria-hidden />}
      {Math.abs(chg)}
    </span>
  )
}

function MiniCard({ row, place }: { row: RawResultRow; place: 1 | 2 | 3 }) {
  const name = str(row.NAME) || "—"
  return (
    <div
      className={cn(
        "border-border bg-card w-[8.5rem] shrink-0 rounded-lg border px-2 py-2",
        place === 1 && "border-amber-400/35"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
            place === 1 && "bg-amber-500/20 text-amber-800 dark:text-amber-200",
            place === 2 && "bg-slate-400/20 text-slate-800 dark:text-slate-200",
            place === 3 && "bg-amber-900/15 text-amber-950 dark:text-amber-100"
          )}
        >
          P{place}
        </span>
        <ChgMini row={row} />
      </div>
      <p className="truncate text-xs font-semibold leading-tight" title={name}>
        {name}
      </p>
      <p className="text-muted-foreground font-mono text-[10px] tabular-nums">{gapLabel(row, place)}</p>
    </div>
  )
}

export function MiniPodium() {
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const results = sessionMeta?.RESULT

  if (!sessionMeta || !results?.length) {
    return null
  }

  const [p1, p2, p3] = getPodiumRows(results)
  if (!p1 && !p2 && !p3) {
    return null
  }

  const order: { row: RawResultRow; place: 1 | 2 | 3 }[] = []
  if (p1) order.push({ row: p1, place: 1 })
  if (p2) order.push({ row: p2, place: 2 })
  if (p3) order.push({ row: p3, place: 3 })

  return (
    <div className="border-border shrink-0 border-b px-2 py-2">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {order.map(({ row, place }) => (
          <MiniCard key={place} row={row} place={place} />
        ))}
      </div>
    </div>
  )
}
