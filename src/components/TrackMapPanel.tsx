import { useMemo } from "react"

import type { LapSectorStatus } from "@/domain"
import { decodeLapStatus } from "@/domain"
import type { RawResultRow } from "@/domain"
import { useI18n } from "@/i18n/I18nContext"
import { useLiveStore } from "@/store/useLiveStore"

/** SVG stroke / fill aligned with {@link SectorCell} token colours (`index.css`). */
function sectorHeatStyle(status: LapSectorStatus): { stroke: string; opacity: number } {
  switch (status) {
    case "sessionBest":
      return { stroke: "var(--sector-session)", opacity: 0.85 }
    case "overallBest":
      return { stroke: "var(--sector-overall)", opacity: 0.85 }
    case "personalBest":
      return { stroke: "var(--sector-personal)", opacity: 0.85 }
    case "pit":
      return { stroke: "var(--sector-pit)", opacity: 0.9 }
    case "inLap":
    case "outLap":
      return { stroke: "var(--muted-foreground)", opacity: 0.55 }
    case "invalid":
      return { stroke: "var(--destructive)", opacity: 0.85 }
    case "normal":
    default:
      return { stroke: "rgb(255 255 255 / 28%)", opacity: 0.55 }
  }
}

/** Nine vertices along a schematic Nordschleife+GP-ish loop (illustrative). */
const SECTOR_POINTS: readonly { x: number; y: number }[] = [
  { x: 40, y: 140 },
  { x: 95, y: 95 },
  { x: 155, y: 110 },
  { x: 210, y: 75 },
  { x: 265, y: 95 },
  { x: 320, y: 60 },
  { x: 370, y: 100 },
  { x: 330, y: 155 },
  { x: 200, y: 175 },
]

function sectorStatusesForRow(row: RawResultRow | undefined): LapSectorStatus[] {
  if (!row) {
    return Array.from({ length: 9 }, (_, i) =>
      (["sessionBest", "personalBest", "normal"] as const)[i % 3]
    )
  }
  return Array.from({ length: 9 }, (_, i) => {
    const key = `ST${i + 1}T` as keyof RawResultRow
    return decodeLapStatus(row[key])
  })
}

export function TrackMapPanel() {
  const { t } = useI18n()
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const firstRow = sessionMeta?.RESULT?.[0]

  const statuses = useMemo(() => sectorStatusesForRow(firstRow), [firstRow])

  const outlineD = useMemo(() => {
    if (SECTOR_POINTS.length < 2) {
      return ""
    }
    const [head, ...tail] = SECTOR_POINTS
    const lines = tail.map((p) => `L ${p.x} ${p.y}`).join(" ")
    return `M ${head.x} ${head.y} ${lines} Z`
  }, [])

  return (
    <section className="border-border bg-card/40 flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <h2 className="font-display text-base font-semibold tracking-tight">{t("trackmap.title")}</h2>
        <p className="text-muted-foreground text-xs">{t("trackmap.hint")}</p>
      </div>
      <svg
        viewBox="0 0 420 200"
        className="text-foreground h-auto max-h-[220px] w-full"
        role="img"
        aria-label={t("trackmap.title")}
      >
        <defs>
          <filter id="track-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        <path
          d={outlineD}
          fill="rgb(255 255 255 / 4%)"
          stroke="rgb(255 255 255 / 14%)"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {statuses.map((status, i) => {
          const a = SECTOR_POINTS[i]
          const b = SECTOR_POINTS[(i + 1) % SECTOR_POINTS.length]
          const { stroke, opacity } = sectorHeatStyle(status)
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          return (
            <g key={`seg-${i}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth={10}
                strokeLinecap="round"
                filter="url(#track-soft)"
              />
              <circle cx={mx} cy={my} r={10} fill="rgb(0 0 0 / 35%)" />
              <text
                x={mx}
                y={my + 4}
                textAnchor="middle"
                className="fill-[var(--foreground)] font-mono text-[10px] font-semibold"
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>
    </section>
  )
}
