import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"

import type { LapSectorStatus, RawResultRow } from "@/domain"
import { decodeLapStatus } from "@/domain"
import { useI18n } from "@/i18n/I18nContext"
import {
  parseTimingSectorLengths,
  resolveSectorGeometry,
  resolveTimingSectorLengths,
  type SectorGeometry,
  type SectorSpan,
  type TimingSectorLengths,
} from "@/lib/trackGeometry"
import { type TrackDriverMarker, type TrackTimingHistory } from "@/lib/trackTiming"
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
import { useTrackMarkerAnimation } from "@/hooks/useTrackMarkerAnimation"
import { useViewportController, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "@/hooks/useViewportController"
import { trackTooltipAnchor } from "@/lib/trackTooltipAnchor"
import { MarkerLayer } from "./MarkerLayer"
import { TrackCarTooltip } from "./TrackCarTooltip"

// -----------------------------------------------------------------------------
// Sector heat styling
// -----------------------------------------------------------------------------

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
    return Array.from(
      { length: SECTOR_END_POINTS.length },
      (_, i) => (["sessionBest", "personalBest", "normal"] as const)[i % 3],
    )
  }
  return Array.from({ length: SECTOR_END_POINTS.length }, (_, i) => {
    const key = `ST${i + 1}T` as keyof RawResultRow
    return decodeLapStatus(row[key])
  })
}

function spanDashArray(span: SectorSpan, totalLength: number): string {
  const visible = Math.max(0, span.endLen - span.startLen)
  const tail = totalLength * 2 + 1
  return `0 ${span.startLen} ${visible} ${tail}`
}

// -----------------------------------------------------------------------------
// Timing sector resolver (cached across renders)
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Panel
// -----------------------------------------------------------------------------

export function TrackMapPanel() {
  const { t } = useI18n()
  const sessionMeta = useLiveStore((s) => s.sessionMeta)
  const track = useLiveStore((s) => s.track)
  const remoteTimeDiffMs = useLiveStore((s) => s.connection.remoteTimeDiffMs)
  const firstRow = sessionMeta?.RESULT?.[0]

  // ---- Geometry + timing resolution ----------------------------------------
  const [pathElement, setPathElement] = useState<SVGPathElement | null>(null)
  const [resolveTimingSectors] = useState(() => createTimingSectorResolver())
  const setMainPathRef = useCallback((node: SVGPathElement | null) => {
    setPathElement(node)
  }, [])
  const statuses = useMemo(() => sectorStatusesForRow(firstRow), [firstRow])
  const geometry = useMemo<SectorGeometry | null>(
    () => (pathElement ? resolveSectorGeometry(pathElement, sessionMeta) : null),
    [pathElement, sessionMeta],
  )
  const timingSectors = useMemo(
    () => resolveTimingSectors(sessionMeta),
    [resolveTimingSectors, sessionMeta],
  )

  // ---- Per-car timing history (mutated in rAF, never triggers re-renders) ---
  const [history] = useState<TrackTimingHistory>(() => new Map())

  // ---- Shared data refs (written by animation hook, read by viewport hook) --
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const driversRef = useRef<Map<string, TrackDriverMarker>>(new Map())

  // ---- DOM refs -------------------------------------------------------------
  const svgRef = useRef<SVGSVGElement | null>(null)
  const markerRefs = useRef<Map<string, SVGGElement>>(new Map())
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  // ---- Viewport controller --------------------------------------------------
  const vp = useViewportController(positionsRef, VIEW_W, VIEW_H)

  // ---- Animation hook -------------------------------------------------------
  const { visibleStnrs, markerRefFor } = useTrackMarkerAnimation({
    geometry,
    timingSectors,
    pathElement,
    sessionMeta,
    trackState: track?.TRACKSTATE ?? sessionMeta?.TRACKSTATE,
    remoteTimeDiffMs,
    history,
    svgRef,
    markerRefs,
    tooltipRef,
    positionsRef,
    driversRef,
    viewportRef: vp.viewportRef,
    followStnrRef: vp.followStnrRef,
    hoveredStnrRef: vp.hoveredStnrRef,
    naturalScaleRef: vp.naturalScaleRef,
    containerSizeRef: vp.containerSizeRef,
  })

  // ---- Sync viewport → SVG transform on non-follow viewport changes ---------
  // The rAF loop also writes this transform every frame, but writing here too
  // keeps the SVG in sync during the React render that updated viewport state.
  useLayoutEffect(() => {
    if (vp.followStnr) return
    const svg = svgRef.current
    if (svg) {
      svg.style.transform = `translate(${vp.viewport.tx}px,${vp.viewport.ty}px) scale(${vp.viewport.scale})`
    }
  }, [vp.viewport, vp.followStnr])

  // ---- Marker event delegation ---------------------------------------------
  const onMarkerLayerPointerOver = useCallback(
    (e: ReactPointerEvent<SVGGElement>) => {
      const g = (e.target as Element).closest("[data-stnr]") as SVGGElement | null
      if (g) vp.setHoveredStnr(g.getAttribute("data-stnr"))
    },
    [vp.setHoveredStnr],
  )

  const onMarkerLayerPointerOut = useCallback(
    (e: ReactPointerEvent<SVGGElement>) => {
      const g = (e.target as Element).closest("[data-stnr]") as SVGGElement | null
      const next = (e.relatedTarget as Element | null)?.closest?.("[data-stnr]")
      if (g && !next) vp.setHoveredStnr(null)
    },
    [vp.setHoveredStnr],
  )

  const onMarkerLayerClick = useCallback(
    (e: ReactMouseEvent<SVGGElement>) => {
      if (vp.wasDragging()) return
      const g = (e.target as Element).closest("[data-stnr]") as SVGGElement | null
      if (!g) return
      const stnr = g.getAttribute("data-stnr")
      if (!stnr) return
      e.stopPropagation()
      vp.setFollow(vp.followStnr === stnr ? null : stnr)
    },
    [vp.wasDragging, vp.setFollow, vp.followStnr],
  )

  const hoveredDriver = vp.hoveredStnr ? driversRef.current.get(vp.hoveredStnr) ?? null : null

  // Initial anchor for tooltip mount — the rAF loop pins it each subsequent frame.
  const tooltipAnchor = useMemo(() => {
    if (!hoveredDriver) return null
    const p = positionsRef.current.get(hoveredDriver.startingNumber)
    if (!p) return { left: 0, top: 0 }
    return trackTooltipAnchor(
      p,
      vp.naturalScale,
      vp.viewport.tx,
      vp.viewport.ty,
      vp.viewport.scale,
      vp.containerSize.w,
      vp.containerSize.h,
    )
  }, [hoveredDriver, vp.naturalScale, vp.viewport, vp.containerSize])

  return (
    <section className="border-border bg-card/40 flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            {t("trackmap.title")}
          </h2>
          <p className="text-muted-foreground text-xs">{t("trackmap.hint")}</p>
        </div>
        <div className="flex items-center gap-2">
          {vp.followStnr ? (
            <button
              type="button"
              onClick={vp.releaseFollow}
              aria-label={t("trackmap.follow.releaseAria")}
              className="border-border bg-card/60 hover:bg-card focus-visible:ring-ring/50 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-mono uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2"
            >
              {t("trackmap.follow.label")} #{vp.followStnr}
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={t("trackmap.zoomAria")}
          >
            <button
              type="button"
              onClick={() =>
                vp.setViewport((prev) => {
                  const cs = vp.containerSizeRef.current
                  const k = prev.scale - ZOOM_STEP
                  const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, k))
                  if (s === prev.scale) return prev
                  const ratio = s / prev.scale
                  return {
                    scale: s,
                    tx: cs.w / 2 - (cs.w / 2 - prev.tx) * ratio,
                    ty: cs.h / 2 - (cs.h / 2 - prev.ty) * ratio,
                  }
                })
              }
              disabled={vp.viewport.scale <= MIN_ZOOM + 1e-6}
              aria-label={t("trackmap.zoomOut")}
              className="border-border bg-card/60 text-foreground hover:bg-card focus-visible:ring-ring/50 disabled:opacity-40 inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
            >
              −
            </button>
            <span
              className="text-muted-foreground font-mono text-[10px] tabular-nums w-10 text-center select-none"
              aria-live="polite"
            >
              {Math.round(vp.viewport.scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                vp.setViewport((prev) => {
                  const cs = vp.containerSizeRef.current
                  const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.scale + ZOOM_STEP))
                  if (s === prev.scale) return prev
                  const ratio = s / prev.scale
                  return {
                    scale: s,
                    tx: cs.w / 2 - (cs.w / 2 - prev.tx) * ratio,
                    ty: cs.h / 2 - (cs.h / 2 - prev.ty) * ratio,
                  }
                })
              }
              disabled={vp.viewport.scale >= MAX_ZOOM - 1e-6}
              aria-label={t("trackmap.zoomIn")}
              className="border-border bg-card/60 text-foreground hover:bg-card focus-visible:ring-ring/50 disabled:opacity-40 inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                vp.setFollow(null)
                vp.setViewport({ scale: 1, tx: 0, ty: 0 })
              }}
              aria-label={t("trackmap.zoomReset")}
              className="border-border bg-card/60 text-foreground hover:bg-card focus-visible:ring-ring/50 ml-1 inline-flex h-7 items-center justify-center rounded-md border px-2 text-[10px] font-mono uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2"
            >
              1:1
            </button>
          </div>
        </div>
      </div>

      <div
        ref={vp.containerRef}
        className="border-border/60 bg-background/60 relative overflow-hidden rounded-lg border touch-none focus:outline-none"
        style={{ height: "min(70vh, 620px)" }}
        role="region"
        aria-label={t("trackmap.title")}
        tabIndex={0}
        onPointerDown={vp.onPointerDown}
        onPointerMove={vp.onPointerMove}
        onPointerUp={vp.onPointerUp}
        onPointerCancel={vp.onPointerCancel}
        onWheel={vp.onWheel}
        onKeyDown={vp.onKeyDown}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={t("trackmap.title")}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            transformOrigin: "0 0",
            cursor: "grab",
          }}
        >
          <defs>
            <filter id="track-soft" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
          </defs>

          <g stroke="rgb(255 255 255 / 22%)" fill="none" strokeLinecap="round">
            {SERVICE_PATHS.map((p, i) => (
              <path key={`svc-${i}`} d={p.d} strokeWidth={p.strokeWidth} />
            ))}
            <path d={PIT_EXIT_PATH_D} strokeWidth={2} />
            <path d={TICK_PATH_D} strokeWidth={4.5} />
          </g>

          <path
            ref={setMainPathRef}
            d={TRACK_MAIN_PATH_D}
            fill="none"
            stroke="rgb(255 255 255 / 14%)"
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={TRACK_MAIN_PATH_D}
            fill="none"
            stroke="rgb(255 255 255 / 30%)"
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

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

          <g fill="#FF0000" fillRule="nonzero" aria-hidden="true">
            {DIRECTION_ARROW_DS.map((d, i) => (
              <path key={`arrow-${i}`} d={d} />
            ))}
          </g>

          <g aria-hidden="true">
            {CHECKERED_TILES.map((tile, i) => (
              <path key={`flag-${i}`} d={tile.d} fill={tile.fill} fillRule="nonzero" />
            ))}
          </g>

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

          <g
            className="font-mono"
            fill="currentColor"
            style={{ color: "var(--muted-foreground)" }}
            aria-hidden="true"
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

          {/* Live car markers — one <g> per STNR, positions written by rAF loop.
              Event delegation on the layer — no per-marker listeners. */}
          <MarkerLayer
            visibleStnrs={visibleStnrs}
            followStnr={vp.followStnr}
            hoveredStnr={vp.hoveredStnr}
            assignRef={markerRefFor}
            onPointerOver={onMarkerLayerPointerOver}
            onPointerOut={onMarkerLayerPointerOut}
            onClick={onMarkerLayerClick}
          />
        </svg>

        {hoveredDriver && tooltipAnchor ? (
          <TrackCarTooltip ref={tooltipRef} driver={hoveredDriver} anchor={tooltipAnchor} />
        ) : null}
      </div>

      <p className="text-muted-foreground/70 text-[10px] leading-relaxed">
        {t("trackmap.attribution")}
      </p>
    </section>
  )
}
