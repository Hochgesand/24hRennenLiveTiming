import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"

import type { LapSectorStatus, RawResultRow } from "@/domain"
import { decodeLapStatus } from "@/domain"
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
  type TrackDriverMarker,
  type TrackTimingHistory,
} from "@/lib/trackTiming"
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
import { TrackCarTooltip, type TrackTooltipAnchor } from "./TrackCarTooltip"

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
// Viewport
// -----------------------------------------------------------------------------

const MIN_ZOOM = 0.6
const MAX_ZOOM = 6
const ZOOM_STEP = 0.3
const KEY_PAN_PX = 32

interface Viewport {
  scale: number
  tx: number
  ty: number
}

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
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

/** Apply a new scale anchored at container-pixel (cx, cy). */
function zoomAt(vp: Viewport, newScale: number, cx: number, cy: number): Viewport {
  if (newScale === vp.scale) return vp
  const k = newScale / vp.scale
  return {
    scale: newScale,
    tx: cx - (cx - vp.tx) * k,
    ty: cy - (cy - vp.ty) * k,
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

  // ---- Per-car timing history (mutated in rAF) -----------------------------
  const [history] = useState<TrackTimingHistory>(() => new Map())

  // ---- Container measurement ------------------------------------------------
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setContainerSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    const r = el.getBoundingClientRect()
    setContainerSize({ w: r.width, h: r.height })
    return () => ro.disconnect()
  }, [])

  // Native viewBox→pixel scale ("meet" letterboxes the smaller axis).
  const naturalScale =
    containerSize.w === 0 || containerSize.h === 0
      ? 1
      : Math.min(containerSize.w / VIEW_W, containerSize.h / VIEW_H)

  // ---- Viewport state -------------------------------------------------------
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, tx: 0, ty: 0 })
  const [followStnr, setFollowStnr] = useState<string | null>(null)
  const [hoveredStnr, setHoveredStnr] = useState<string | null>(null)

  // ---- Refs used by the rAF loop (no re-render on change) ------------------
  const svgRef = useRef<SVGSVGElement | null>(null)
  const markerRefs = useRef<Map<string, SVGGElement>>(new Map())
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const driversRef = useRef<Map<string, TrackDriverMarker>>(new Map())
  const viewportRef = useRef(viewport)
  const followStnrRef = useRef(followStnr)
  const hoveredStnrRef = useRef(hoveredStnr)
  const naturalScaleRef = useRef(naturalScale)
  const containerSizeRef = useRef(containerSize)
  viewportRef.current = viewport
  followStnrRef.current = followStnr
  hoveredStnrRef.current = hoveredStnr
  naturalScaleRef.current = naturalScale
  containerSizeRef.current = containerSize

  // The set of visible stnrs drives React re-render of the marker list.
  const [visibleStnrs, setVisibleStnrs] = useState<string[]>([])

  // Marker ref callback (factory-cached per stnr so the same closure is reused).
  const markerRefCallbacks = useRef<Map<string, (el: SVGGElement | null) => void>>(new Map())
  function markerRefFor(stnr: string): (el: SVGGElement | null) => void {
    const existing = markerRefCallbacks.current.get(stnr)
    if (existing) return existing
    const cb = (el: SVGGElement | null) => {
      if (el) markerRefs.current.set(stnr, el)
      else markerRefs.current.delete(stnr)
    }
    markerRefCallbacks.current.set(stnr, cb)
    return cb
  }

  // ---- rAF loop: imperative DOM updates -----------------------------------
  useEffect(() => {
    if (!geometry || !timingSectors || !pathElement || !svgRef.current) return
    let frame = 0
    let lastStnrKey = ""

    const tick = () => {
      const drivers = computeTrackDrivers({
        session: sessionMeta,
        trackState: track?.TRACKSTATE ?? sessionMeta?.TRACKSTATE,
        remoteTimeDiffMs,
        trackPathLength: geometry.totalLength,
        history,
      })

      const positions = positionsRef.current
      const driverMap = driversRef.current
      positions.clear()
      driverMap.clear()
      const visibleNow: string[] = []

      for (const d of drivers) {
        driverMap.set(d.startingNumber, d)
        if (!d.visible) continue
        const len = distanceToPathLength(d.distanceM, timingSectors, geometry)
        const p = pathElement.getPointAtLength(len)
        positions.set(d.startingNumber, { x: p.x, y: p.y })
        visibleNow.push(d.startingNumber)

        const g = markerRefs.current.get(d.startingNumber)
        if (g) g.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`)
      }

      // Visible-set change → trigger React re-render of the marker list.
      const key = visibleNow.join(",")
      if (key !== lastStnrKey) {
        lastStnrKey = key
        setVisibleStnrs(visibleNow)
      }

      // Follow-car: override the SVG CSS transform to keep target centered.
      const svg = svgRef.current
      const vp = viewportRef.current
      const ns = naturalScaleRef.current
      const cs = containerSizeRef.current
      const fStnr = followStnrRef.current
      if (svg) {
        if (fStnr) {
          const fp = positions.get(fStnr)
          if (fp) {
            const tx = cs.w / 2 - fp.x * ns * vp.scale
            const ty = cs.h / 2 - fp.y * ns * vp.scale
            svg.style.transform = `translate(${tx}px, ${ty}px) scale(${vp.scale})`
          }
        } else {
          svg.style.transform = `translate(${vp.tx}px, ${vp.ty}px) scale(${vp.scale})`
        }
      }

      // Tooltip follow.
      const hStnr = hoveredStnrRef.current
      const tip = tooltipRef.current
      if (hStnr && tip) {
        const hp = positions.get(hStnr)
        if (hp) {
          const tx =
            fStnr
              ? cs.w / 2 - (positions.get(fStnr)?.x ?? hp.x) * ns * vp.scale
              : vp.tx
          const ty =
            fStnr
              ? cs.h / 2 - (positions.get(fStnr)?.y ?? hp.y) * ns * vp.scale
              : vp.ty
          const px = hp.x * ns * vp.scale + tx
          const py = hp.y * ns * vp.scale + ty
          const offset = 14
          const tipW = tip.offsetWidth || 210
          const tipH = tip.offsetHeight || 100
          const flipX = px + offset + tipW > cs.w
          const flipY = py + offset + tipH > cs.h
          const left = Math.max(2, flipX ? px - tipW - offset : px + offset)
          const top = Math.max(2, flipY ? py - tipH - offset : py + offset)
          tip.style.left = `${left}px`
          tip.style.top = `${top}px`
        }
      }

      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [
    geometry,
    timingSectors,
    pathElement,
    sessionMeta,
    track?.TRACKSTATE,
    remoteTimeDiffMs,
    history,
  ])

  // When viewport changes (e.g. user pan) and not following, update SVG style now —
  // the rAF loop also writes the transform, but writing here too keeps the SVG in
  // sync during the React render that updated viewport state.
  useLayoutEffect(() => {
    if (followStnr) return
    const svg = svgRef.current
    if (svg) {
      svg.style.transform = `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.scale})`
    }
  }, [viewport, followStnr])

  // ---- Pointer handling -----------------------------------------------------
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const dragState = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startTx: number
    startTy: number
    moved: boolean
  } | null>(null)
  const pinchState = useRef<{
    startDist: number
    startScale: number
    centerX: number
    centerY: number
  } | null>(null)

  const localPoint = (clientX: number, clientY: number) => {
    const r = containerRef.current?.getBoundingClientRect()
    return r ? { x: clientX - r.left, y: clientY - r.top } : { x: clientX, y: clientY }
  }

  /** Effective viewport for drag-anchor calculations (follow mode overrides tx/ty). */
  const effectiveStart = (): { tx: number; ty: number; scale: number } => {
    const vp = viewportRef.current
    const fStnr = followStnrRef.current
    if (fStnr) {
      const fp = positionsRef.current.get(fStnr)
      if (fp) {
        return {
          scale: vp.scale,
          tx: containerSizeRef.current.w / 2 - fp.x * naturalScaleRef.current * vp.scale,
          ty: containerSizeRef.current.h / 2 - fp.y * naturalScaleRef.current * vp.scale,
        }
      }
    }
    return vp
  }

  /** Release follow lock and commit the current visual position into viewport state. */
  const releaseFollow = () => {
    if (followStnrRef.current === null) return
    const cur = effectiveStart()
    setFollowStnr(null)
    setViewport({ scale: cur.scale, tx: cur.tx, ty: cur.ty })
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.current.size === 1) {
      const eff = effectiveStart()
      dragState.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startTx: eff.tx,
        startTy: eff.ty,
        moved: false,
      }
    } else if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values())
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const dist = Math.hypot(dx, dy) || 1
      const mid = localPoint((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2)
      pinchState.current = {
        startDist: dist,
        startScale: effectiveStart().scale,
        centerX: mid.x,
        centerY: mid.y,
      }
      dragState.current = null
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(e.pointerId)) return
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.current.size >= 2 && pinchState.current) {
      const pts = Array.from(activePointers.current.values()).slice(0, 2)
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
      const ratio = d / pinchState.current.startDist
      const newScale = clampZoom(pinchState.current.startScale * ratio)
      if (followStnrRef.current) releaseFollow()
      setViewport((vp) =>
        zoomAt(vp, newScale, pinchState.current!.centerX, pinchState.current!.centerY),
      )
      return
    }

    if (dragState.current && dragState.current.pointerId === e.pointerId) {
      const dx = e.clientX - dragState.current.startClientX
      const dy = e.clientY - dragState.current.startClientY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.current.moved = true
      if (followStnrRef.current) {
        // Cancel follow but keep the drag continuing smoothly.
        setFollowStnr(null)
      }
      setViewport((vp) => ({
        ...vp,
        tx: dragState.current!.startTx + dx,
        ty: dragState.current!.startTy + dy,
      }))
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size < 2) pinchState.current = null
    if (dragState.current && dragState.current.pointerId === e.pointerId) {
      dragState.current = null
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Capture may have been released already — safe to ignore.
    }
  }

  // ---- Wheel + keyboard -----------------------------------------------------
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const factor = Math.exp(-e.deltaY * 0.0015)
    const lp = localPoint(e.clientX, e.clientY)
    if (followStnrRef.current) {
      // Zoom in/out around the centre when following.
      setViewport((vp) => ({ ...vp, scale: clampZoom(vp.scale * factor) }))
    } else {
      setViewport((vp) => zoomAt(vp, clampZoom(vp.scale * factor), lp.x, lp.y))
    }
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      if (followStnrRef.current) {
        releaseFollow()
        e.preventDefault()
      }
      return
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault()
      setViewport((vp) =>
        zoomAt(vp, clampZoom(vp.scale + ZOOM_STEP), containerSize.w / 2, containerSize.h / 2),
      )
      return
    }
    if (e.key === "-" || e.key === "_") {
      e.preventDefault()
      setViewport((vp) =>
        zoomAt(vp, clampZoom(vp.scale - ZOOM_STEP), containerSize.w / 2, containerSize.h / 2),
      )
      return
    }
    if (e.key === "0") {
      e.preventDefault()
      setFollowStnr(null)
      setViewport({ scale: 1, tx: 0, ty: 0 })
      return
    }
    const arrow =
      e.key === "ArrowLeft"
        ? { dx: KEY_PAN_PX, dy: 0 }
        : e.key === "ArrowRight"
          ? { dx: -KEY_PAN_PX, dy: 0 }
          : e.key === "ArrowUp"
            ? { dx: 0, dy: KEY_PAN_PX }
            : e.key === "ArrowDown"
              ? { dx: 0, dy: -KEY_PAN_PX }
              : null
    if (arrow) {
      e.preventDefault()
      if (followStnrRef.current) releaseFollow()
      setViewport((vp) => ({ ...vp, tx: vp.tx + arrow.dx, ty: vp.ty + arrow.dy }))
    }
  }

  // ---- Marker hover / click delegation (single handler set) ----------------
  const onMarkerLayerPointerOver = (e: ReactPointerEvent<SVGGElement>) => {
    const g = (e.target as Element).closest("[data-stnr]") as SVGGElement | null
    if (g) setHoveredStnr(g.getAttribute("data-stnr"))
  }
  const onMarkerLayerPointerOut = (e: ReactPointerEvent<SVGGElement>) => {
    const g = (e.target as Element).closest("[data-stnr]") as SVGGElement | null
    const next = (e.relatedTarget as Element | null)?.closest?.("[data-stnr]")
    if (g && !next) setHoveredStnr(null)
  }
  const onMarkerLayerClick = (e: React.MouseEvent<SVGGElement>) => {
    if (dragState.current?.moved) return
    const g = (e.target as Element).closest("[data-stnr]") as SVGGElement | null
    if (!g) return
    const stnr = g.getAttribute("data-stnr")
    if (!stnr) return
    e.stopPropagation()
    setFollowStnr((cur) => (cur === stnr ? null : stnr))
  }

  const hoveredDriver = hoveredStnr ? driversRef.current.get(hoveredStnr) ?? null : null

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
          {followStnr ? (
            <button
              type="button"
              onClick={releaseFollow}
              aria-label={t("trackmap.follow.releaseAria")}
              className="border-border bg-card/60 hover:bg-card focus-visible:ring-ring/50 inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-mono uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2"
            >
              {t("trackmap.follow.label")} #{followStnr}
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
                setViewport((vp) =>
                  zoomAt(
                    vp,
                    clampZoom(vp.scale - ZOOM_STEP),
                    containerSize.w / 2,
                    containerSize.h / 2,
                  ),
                )
              }
              disabled={viewport.scale <= MIN_ZOOM + 1e-6}
              aria-label={t("trackmap.zoomOut")}
              className="border-border bg-card/60 text-foreground hover:bg-card focus-visible:ring-ring/50 disabled:opacity-40 inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
            >
              −
            </button>
            <span
              className="text-muted-foreground font-mono text-[10px] tabular-nums w-10 text-center select-none"
              aria-live="polite"
            >
              {Math.round(viewport.scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setViewport((vp) =>
                  zoomAt(
                    vp,
                    clampZoom(vp.scale + ZOOM_STEP),
                    containerSize.w / 2,
                    containerSize.h / 2,
                  ),
                )
              }
              disabled={viewport.scale >= MAX_ZOOM - 1e-6}
              aria-label={t("trackmap.zoomIn")}
              className="border-border bg-card/60 text-foreground hover:bg-card focus-visible:ring-ring/50 disabled:opacity-40 inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-semibold disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                setFollowStnr(null)
                setViewport({ scale: 1, tx: 0, ty: 0 })
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
        ref={containerRef}
        className="border-border/60 bg-background/60 relative overflow-hidden rounded-lg border touch-none focus:outline-none"
        style={{ height: "min(70vh, 620px)" }}
        role="region"
        aria-label={t("trackmap.title")}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
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

          {/* Live car markers — positions imperatively updated each rAF tick.
              The marker layer uses event delegation so only one set of listeners
              is attached, regardless of car count. */}
          <g
            className="track-car-markers"
            aria-label="Cars on track"
            onPointerOver={onMarkerLayerPointerOver}
            onPointerOut={onMarkerLayerPointerOut}
            onClick={onMarkerLayerClick}
          >
            {visibleStnrs.map((stnr) => {
              const isFollowed = stnr === followStnr
              const isHovered = stnr === hoveredStnr
              return (
                <g
                  key={stnr}
                  ref={markerRefFor(stnr)}
                  data-stnr={stnr}
                  style={{ cursor: "pointer", pointerEvents: "auto" }}
                  transform="translate(0 0)"
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={isFollowed || isHovered ? 8 : 7}
                    fill={isFollowed ? "var(--accent, #f5d76e)" : "#fff"}
                    stroke="#000"
                    strokeWidth={1.2}
                  />
                  <text
                    x={0}
                    y={2.5}
                    textAnchor="middle"
                    className="fill-black font-mono font-bold"
                    fontSize={5.5}
                    aria-hidden="true"
                  >
                    {stnr}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {hoveredDriver ? (
          <TrackCarTooltip
            ref={tooltipRef}
            driver={hoveredDriver}
            // Initial anchor is the last-known position; the rAF loop pins it each frame.
            anchor={tooltipInitialAnchor(positionsRef.current, hoveredDriver.startingNumber, naturalScale, viewport, containerSize)}
          />
        ) : null}
      </div>

      <p className="text-muted-foreground/70 text-[10px] leading-relaxed">
        {t("trackmap.attribution")}
      </p>
    </section>
  )
}

function tooltipInitialAnchor(
  positions: Map<string, { x: number; y: number }>,
  stnr: string,
  ns: number,
  vp: Viewport,
  cs: { w: number; h: number },
): TrackTooltipAnchor {
  const p = positions.get(stnr)
  if (!p) return { x: 0, y: 0, containerW: cs.w, containerH: cs.h }
  return {
    x: p.x * ns * vp.scale + vp.tx,
    y: p.y * ns * vp.scale + vp.ty,
    containerW: cs.w,
    containerH: cs.h,
  }
}
