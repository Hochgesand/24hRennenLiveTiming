import { useEffect, useMemo, useRef, useState } from "react"

import type { LapSectorStatus } from "@/domain"
import { decodeLapStatus } from "@/domain"
import type { RawResultRow } from "@/domain"
import { useI18n } from "@/i18n/I18nContext"
import {
  CHECKERED_TILES,
  DIRECTION_ARROW_DS,
  PIT_EXIT_PATH_D,
  SECTOR_END_POINTS,
  SERVICE_PATHS,
  TICK_PATH_D,
  TRACK_LABELS,
  TRACK_MAIN_PATH_D,
  VIEW_H,
  VIEW_W,
} from "@/assets/nuerburgring24h"
import { useLiveStore } from "@/store/useLiveStore"

/** SVG stroke aligned with {@link SectorCell} token colours (`index.css`). */
function sectorHeatStyle(status: LapSectorStatus): { stroke: string; opacity: number } {
  switch (status) {
    case "sessionBest":
      return { stroke: "var(--sector-session)", opacity: 0.95 }
    case "overallBest":
      return { stroke: "var(--sector-overall)", opacity: 0.95 }
    case "personalBest":
      return { stroke: "var(--sector-personal)", opacity: 0.95 }
    case "pit":
      return { stroke: "var(--sector-pit)", opacity: 0.95 }
    case "inLap":
    case "outLap":
      return { stroke: "var(--muted-foreground)", opacity: 0.7 }
    case "invalid":
      return { stroke: "var(--destructive)", opacity: 0.95 }
    case "normal":
    default:
      return { stroke: "rgb(255 255 255 / 45%)", opacity: 0.85 }
  }
}

function sectorStatusesForRow(row: RawResultRow | undefined): LapSectorStatus[] {
  if (!row) {
    return Array.from({ length: SECTOR_END_POINTS.length }, (_, i) =>
      (["sessionBest", "personalBest", "normal"] as const)[i % 3]
    )
  }
  return Array.from({ length: SECTOR_END_POINTS.length }, (_, i) => {
    const key = `ST${i + 1}T` as keyof RawResultRow
    return decodeLapStatus(row[key])
  })
}

/**
 * Nine sector arcs, each resolved as one or more `{ startLen, endLen }` spans
 * along the main track path. Sectors wrap the path start when needed (since
 * the SVG's `M ...` is not exactly at the Start/Ziel line).
 */
type SectorSpan = { startLen: number; endLen: number }
type SectorGeometry = {
  /** Total path length, in SVG user units. */
  totalLength: number
  /** One entry per sector; may contain two spans when the sector wraps. */
  sectors: SectorSpan[][]
  /** Marker positions (end of each sector) in viewBox coords. */
  markers: { x: number; y: number }[]
}

function resolveSectorGeometry(path: SVGPathElement): SectorGeometry {
  const L = path.getTotalLength()
  if (!Number.isFinite(L) || L <= 0) {
    return {
      totalLength: 0,
      sectors: SECTOR_END_POINTS.map(() => []),
      markers: SECTOR_END_POINTS.map(() => ({ x: 0, y: 0 })),
    }
  }

  // Walk the path once, sampling at ~0.5-unit resolution, and keep the best
  // distance for each sector landmark in a single pass.
  const STEP = 0.5
  const bestDist = SECTOR_END_POINTS.map(() => Infinity)
  const bestLen = SECTOR_END_POINTS.map(() => 0)
  const markers = SECTOR_END_POINTS.map(() => ({ x: 0, y: 0 }))

  for (let d = 0; d < L; d += STEP) {
    const p = path.getPointAtLength(d)
    for (let i = 0; i < SECTOR_END_POINTS.length; i++) {
      const dx = p.x - SECTOR_END_POINTS[i].x
      const dy = p.y - SECTOR_END_POINTS[i].y
      const sq = dx * dx + dy * dy
      if (sq < bestDist[i]) {
        bestDist[i] = sq
        bestLen[i] = d
        markers[i] = { x: p.x, y: p.y }
      }
    }
  }

  // The landmark array is ordered by driving direction (S1 end → S9 end).
  // Sector i starts at the previous landmark and ends at the current one,
  // with the first sector starting at the last landmark (Start/Ziel).
  const sectors: SectorSpan[][] = []
  for (let i = 0; i < bestLen.length; i++) {
    const prev = i === 0 ? bestLen[bestLen.length - 1] : bestLen[i - 1]
    const curr = bestLen[i]
    if (prev <= curr) {
      sectors.push([{ startLen: prev, endLen: curr }])
    } else {
      // Wrap around the path start: draw [prev, L] and [0, curr] as two spans.
      sectors.push([
        { startLen: prev, endLen: L },
        { startLen: 0, endLen: curr },
      ])
    }
  }

  return { totalLength: L, sectors, markers }
}

/** Build a `stroke-dasharray` that renders only `[startLen, endLen]`. */
function spanDashArray(span: SectorSpan, totalLength: number): string {
  const visible = Math.max(0, span.endLen - span.startLen)
  const tail = totalLength * 2 + 1
  return `0 ${span.startLen} ${visible} ${tail}`
}

const MIN_ZOOM = 0.6
const MAX_ZOOM = 4
const ZOOM_STEP = 0.3
const BASE_WIDTH_PX = 1100

export function TrackMapPanel() {
  const { t } = useI18n()
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const firstRow = sessionMeta?.RESULT?.[0]

  const [zoom, setZoom] = useState(1)
  const [geometry, setGeometry] = useState<SectorGeometry | null>(null)

  const statuses = useMemo(() => sectorStatusesForRow(firstRow), [firstRow])
  const pathRef = useRef<SVGPathElement | null>(null)

  // Resolve the sector cuts once the main path has mounted. Running this in a
  // simple effect (instead of useLayoutEffect) keeps SSR / jsdom-test paths
  // happy; the initial render shows the raw track until geometry arrives.
  useEffect(() => {
    if (!pathRef.current) return
    setGeometry(resolveSectorGeometry(pathRef.current))
  }, [])

  const canZoomIn = zoom < MAX_ZOOM - 1e-6
  const canZoomOut = zoom > MIN_ZOOM + 1e-6

  const svgWidth = BASE_WIDTH_PX * zoom
  const svgHeight = (BASE_WIDTH_PX * VIEW_H * zoom) / VIEW_W

  return (
    <section className="border-border bg-card/40 flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            {t("trackmap.title")}
          </h2>
          <p className="text-muted-foreground text-xs">{t("trackmap.hint")}</p>
        </div>
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("trackmap.zoomAria")}
        >
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
            disabled={!canZoomOut}
            aria-label={t("trackmap.zoomOut")}
            className="border-border bg-card/60 text-foreground hover:bg-card focus-visible:ring-ring/50 disabled:opacity-40 inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
          >
            −
          </button>
          <span
            className="text-muted-foreground font-mono text-[10px] tabular-nums w-10 text-center select-none"
            aria-live="polite"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
            disabled={!canZoomIn}
            aria-label={t("trackmap.zoomIn")}
            className="border-border bg-card/60 text-foreground hover:bg-card focus-visible:ring-ring/50 disabled:opacity-40 inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label={t("trackmap.zoomReset")}
            className="border-border bg-card/60 text-foreground hover:bg-card focus-visible:ring-ring/50 ml-1 inline-flex h-7 items-center justify-center rounded-md border px-2 text-[10px] font-mono uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2"
          >
            1:1
          </button>
        </div>
      </div>

      <div
        className="border-border/60 bg-background/60 relative overflow-auto rounded-lg border"
        style={{ maxHeight: "min(70vh, 620px)" }}
        role="region"
        aria-label={t("trackmap.title")}
        tabIndex={0}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width={svgWidth}
          height={svgHeight}
          className="block"
          role="img"
          aria-label={t("trackmap.title")}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="track-soft" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
          </defs>

          {/* Access / service roads (as in the source map). */}
          <g stroke="rgb(255 255 255 / 22%)" fill="none" strokeLinecap="round">
            {SERVICE_PATHS.map((p, i) => (
              <path key={`svc-${i}`} d={p.d} strokeWidth={p.strokeWidth} />
            ))}
            <path d={PIT_EXIT_PATH_D} strokeWidth={2} />
            <path d={TICK_PATH_D} strokeWidth={4.5} />
          </g>

          {/* Main circuit — muted base so sectors overlay cleanly on top. */}
          <path
            ref={pathRef}
            d={TRACK_MAIN_PATH_D}
            fill="none"
            stroke="rgb(255 255 255 / 14%)"
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Track surface highlight (thin bright centerline under the heat). */}
          <path
            d={TRACK_MAIN_PATH_D}
            fill="none"
            stroke="rgb(255 255 255 / 30%)"
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Coloured sector overlays, resolved from the measured path. */}
          {geometry
            ? geometry.sectors.map((spans, i) => {
                const { stroke, opacity } = sectorHeatStyle(statuses[i])
                return (
                  <g
                    key={`sec-${i + 1}`}
                    stroke={stroke}
                    strokeOpacity={opacity}
                    strokeWidth={5}
                    strokeLinecap="butt"
                    strokeLinejoin="round"
                    fill="none"
                    filter="url(#track-soft)"
                  >
                    <title>{`S${i + 1} — ${SECTOR_END_POINTS[i].label}`}</title>
                    {spans.map((span, j) => (
                      <path
                        key={`sec-${i + 1}-${j}`}
                        d={TRACK_MAIN_PATH_D}
                        strokeDasharray={spanDashArray(span, geometry.totalLength)}
                      />
                    ))}
                  </g>
                )
              })
            : null}

          {/* Red direction arrows (from source SVG). */}
          <g fill="#FF0000" fillRule="nonzero" aria-hidden="true">
            {DIRECTION_ARROW_DS.map((d, i) => (
              <path key={`arrow-${i}`} d={d} />
            ))}
          </g>

          {/* Start/Ziel checkered flag. */}
          <g aria-hidden="true">
            {CHECKERED_TILES.map((tile, i) => (
              <path key={`flag-${i}`} d={tile.d} fill={tile.fill} fillRule="nonzero" />
            ))}
          </g>

          {/* Numbered sector markers at each sector end. */}
          {geometry
            ? geometry.markers.map((m, i) => (
                <g key={`mark-${i}`} aria-hidden="true">
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r={6}
                    fill="rgb(0 0 0 / 85%)"
                    stroke="rgb(255 255 255 / 80%)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={m.x}
                    y={m.y + 2.1}
                    textAnchor="middle"
                    className="fill-[var(--foreground)] font-mono font-semibold"
                    fontSize={6.5}
                  >
                    {i + 1}
                  </text>
                </g>
              ))
            : null}

          {/* Turn labels (opacity matches the source SVG). */}
          <g
            className="font-mono"
            fill="currentColor"
            style={{ color: "var(--muted-foreground)" }}
          >
            {TRACK_LABELS.map((label, i) => (
              <text
                key={`label-${i}`}
                x={label.x}
                y={label.y}
                fontSize={(label.size ?? 8) * 1}
                opacity={0.75}
              >
                {label.lines.map((line, j) => (
                  <tspan key={j} x={label.x} dy={j === 0 ? 0 : 10}>
                    {line}
                  </tspan>
                ))}
              </text>
            ))}
          </g>
        </svg>
      </div>

      <p className="text-muted-foreground/70 text-[10px] leading-relaxed">
        {t("trackmap.attribution")}
      </p>
    </section>
  )
}
