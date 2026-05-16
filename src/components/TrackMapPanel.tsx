import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { LapSectorStatus } from "@/domain"
import { decodeLapStatus } from "@/domain"
import type { RawResultRow } from "@/domain"
import { useI18n } from "@/i18n/I18nContext"
import {
  distanceToPathLength,
  parseTimingSectorLengths,
  resolveSectorGeometry,
  resolveTimingSectorLengths,
  type SectorGeometry,
  type SectorSpan,
  type TimingSectorLengths,
} from "@/lib/trackGeometry"
import {
  computeTrackDrivers,
  type TrackDriverHistory,
  type TrackDriverMarker,
} from "@/lib/trackPositions"
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

/** EMA time constant for marker smoothing (seconds). */
const EMA_TAU = 0.25

function driverMarkerLabel(d: TrackDriverMarker): string {
  const parts = [`#${d.startingNumber}`]
  if (d.name) {
    parts.push(d.name)
  }
  if (d.position) {
    parts.push(`P${d.position}`)
  }
  if (d.className) {
    parts.push(d.className)
  }
  return parts.join(" · ")
}

function createTimingSectorResolver() {
  let cached: TimingSectorLengths | null = null
  return (session: Parameters<typeof parseTimingSectorLengths>[0]) => {
    const parsed = parseTimingSectorLengths(session)
    if (parsed) {
      cached = parsed
      return parsed
    }
    return resolveTimingSectorLengths(session, cached)
  }
}

export function TrackCarMarkers({
  drivers,
  pathLengthForDriver,
  getPointAtLength,
}: {
  drivers: TrackDriverMarker[]
  pathLengthForDriver: (driver: TrackDriverMarker) => number
  getPointAtLength: (len: number) => { x: number; y: number }
}) {
  const visible = drivers.filter((d) => d.visible)
  return (
    <g className="track-car-markers" aria-label="Cars on track">
      {[...visible].reverse().map((d) => {
        const len = pathLengthForDriver(d)
        const { x, y } = getPointAtLength(len)
        const label = driverMarkerLabel(d)
        return (
          <g key={d.startingNumber} role="img" aria-label={label}>
            <title>{label}</title>
            <circle
              cx={x}
              cy={y}
              r={7}
              fill="#fff"
              stroke="#000"
              strokeWidth={1.2}
            />
            <text
              x={x}
              y={y + 2.5}
              textAnchor="middle"
              className="fill-black font-mono font-bold"
              fontSize={5.5}
              aria-hidden="true"
            >
              {d.startingNumber}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function TrackMapPanel() {
  const { t } = useI18n()
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const track = useLiveStore((s) => s.track)
  const remoteTimeDiffMs = useLiveStore((s) => s.connection.remoteTimeDiffMs)
  const firstRow = sessionMeta?.RESULT?.[0]

  const [zoom, setZoom] = useState(1)
  const [, setAnimTick] = useState(0)
  const [pathElement, setPathElement] = useState<SVGPathElement | null>(null)
  const [resolveTimingSectors] = useState(() => createTimingSectorResolver())

  /** Persistent staleness cache — prevents stale PID 0 rows from pulling markers back. */
  const historyRef = useRef<TrackDriverHistory>(new Map())
  /** Per-car EMA-smoothed SVG path lengths (updated each animation frame). */
  const displayedLenRef = useRef<Map<string, number>>(new Map())
  /** Timestamp of the previous animation frame (ms) for EMA dt computation. */
  const lastFrameTsRef = useRef<number | undefined>(undefined)

  const statuses = useMemo(() => sectorStatusesForRow(firstRow), [firstRow])
  const geometry = useMemo<SectorGeometry | null>(
    () => (pathElement ? resolveSectorGeometry(pathElement, sessionMeta) : null),
    [pathElement, sessionMeta],
  )
  const timingSectors = useMemo(() => {
    return resolveTimingSectors(sessionMeta)
  }, [resolveTimingSectors, sessionMeta])
  const setMainPathRef = useCallback((node: SVGPathElement | null) => {
    setPathElement(node)
  }, [])

  useEffect(() => {
    let frame = 0
    const loop = () => {
      setAnimTick((n) => (n + 1) % 1_000_000)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  const drivers = computeTrackDrivers({
    session: sessionMeta,
    trackState: track?.TRACKSTATE ?? sessionMeta?.TRACKSTATE,
    remoteTimeDiffMs,
    trackPathLength: geometry?.totalLength ?? 0,
    history: historyRef.current,
  })

  // --- Per-frame EMA smoothing ---
  // Runs every render (driven by the rAF animTick), mutating displayedLenRef
  // so TrackCarMarkers always reads a smoothly interpolated path length.
  {
    const now = Date.now()
    const dtSec =
      lastFrameTsRef.current !== undefined
        ? Math.max(0, (now - lastFrameTsRef.current) / 1000)
        : 0
    lastFrameTsRef.current = now

    if (geometry && timingSectors) {
      const totalLength = geometry.totalLength
      const alpha = dtSec > 0 ? 1 - Math.exp(-dtSec / EMA_TAU) : 1
      for (const driver of drivers) {
        if (!driver.visible) {
          displayedLenRef.current.delete(driver.startingNumber)
          continue
        }
        const rawLen = distanceToPathLength(driver.distanceM, timingSectors, geometry)
        const prev = displayedLenRef.current.get(driver.startingNumber)
        if (prev === undefined) {
          displayedLenRef.current.set(driver.startingNumber, rawLen)
        } else {
          // Snap across the start/finish seam to avoid tweening the wrong way around.
          const displayed =
            Math.abs(rawLen - prev) > totalLength / 2
              ? rawLen
              : prev + (rawLen - prev) * alpha
          displayedLenRef.current.set(driver.startingNumber, displayed)
        }
      }
    }
  }

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
            ref={setMainPathRef}
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

          {geometry && pathElement ? (
            <TrackCarMarkers
              drivers={drivers}
              pathLengthForDriver={(driver) =>
                displayedLenRef.current.get(driver.startingNumber) ??
                (timingSectors
                  ? distanceToPathLength(driver.distanceM, timingSectors, geometry)
                  : driver.pathFraction * geometry.totalLength)
              }
              getPointAtLength={(len) => pathElement.getPointAtLength(len)}
            />
          ) : null}
        </svg>
      </div>

      <p className="text-muted-foreground/70 text-[10px] leading-relaxed">
        {t("trackmap.attribution")}
      </p>
    </section>
  )
}
