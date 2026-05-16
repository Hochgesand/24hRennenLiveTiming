import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const MIN_ZOOM = 0.6
export const MAX_ZOOM = 6
export const ZOOM_STEP = 0.3
const KEY_PAN_PX = 32

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ViewportState {
  scale: number
  tx: number
  ty: number
}

export interface UseViewportControllerResult {
  // React state (trigger re-renders for UI)
  viewport: ViewportState
  followStnr: string | null
  hoveredStnr: string | null
  containerSize: { w: number; h: number }
  naturalScale: number

  // Stable refs (safe to read from rAF without causing re-renders)
  viewportRef: React.RefObject<ViewportState>
  followStnrRef: React.RefObject<string | null>
  hoveredStnrRef: React.RefObject<string | null>
  naturalScaleRef: React.RefObject<number>
  containerSizeRef: React.RefObject<{ w: number; h: number }>

  // DOM ref — attach to the container <div>
  containerRef: React.RefObject<HTMLDivElement | null>

  // Actions
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>
  setFollow: (stnr: string | null) => void
  releaseFollow: () => void
  setHoveredStnr: (stnr: string | null) => void
  /** Returns true if the most recent pointer gesture was a drag (> 3 px). */
  wasDragging: () => boolean

  // Event handlers — spread onto the container <div>
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void
  onWheel: (e: ReactWheelEvent<HTMLDivElement>) => void
  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
}

/** Apply a new scale anchored at container-pixel (cx, cy). */
function zoomAt(vp: ViewportState, newScale: number, cx: number, cy: number): ViewportState {
  if (newScale === vp.scale) return vp
  const k = newScale / vp.scale
  return { scale: newScale, tx: cx - (cx - vp.tx) * k, ty: cy - (cy - vp.ty) * k }
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Owns all viewport state (zoom, pan, follow-car) and the pointer/keyboard
 * event handlers for the track-map container.
 *
 * @param positionsRef - Ref to the map of SVG-coord positions maintained by the
 *   animation hook. Used to compute the visual position of the followed car
 *   when committing follow state on release or drag-start.
 * @param viewW / viewH - SVG viewBox dimensions, used for natural-scale calc.
 */
export function useViewportController(
  positionsRef: React.RefObject<Map<string, { x: number; y: number }>>,
  viewW: number,
  viewH: number,
): UseViewportControllerResult {
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

  const naturalScale =
    containerSize.w === 0 || containerSize.h === 0
      ? 1
      : Math.min(containerSize.w / viewW, containerSize.h / viewH)

  // ---- Viewport state -------------------------------------------------------
  const [viewport, setViewport] = useState<ViewportState>({ scale: 1, tx: 0, ty: 0 })
  const [followStnr, setFollowStnrState] = useState<string | null>(null)
  const [hoveredStnr, setHoveredStnrState] = useState<string | null>(null)

  // ---- Stable refs (read in rAF without stale-closure issues) ---------------
  const viewportRef = useRef<ViewportState>(viewport)
  const followStnrRef = useRef<string | null>(followStnr)
  const hoveredStnrRef = useRef<string | null>(hoveredStnr)
  const naturalScaleRef = useRef(naturalScale)
  const containerSizeRef = useRef(containerSize)
  viewportRef.current = viewport
  followStnrRef.current = followStnr
  hoveredStnrRef.current = hoveredStnr
  naturalScaleRef.current = naturalScale
  containerSizeRef.current = containerSize

  // ---- Setters --------------------------------------------------------------
  const setFollow = useCallback((stnr: string | null) => setFollowStnrState(stnr), [])
  const setHoveredStnr = useCallback((stnr: string | null) => setHoveredStnrState(stnr), [])

  // ---- Follow helpers -------------------------------------------------------

  /** Compute the effective tx/ty/scale for the current visual state. */
  const effectiveViewport = useCallback((): ViewportState => {
    const vp = viewportRef.current
    const fStnr = followStnrRef.current
    if (fStnr) {
      const fp = positionsRef.current.get(fStnr)
      if (fp) {
        const cs = containerSizeRef.current
        const ns = naturalScaleRef.current
        return {
          scale: vp.scale,
          tx: cs.w / 2 - fp.x * ns * vp.scale,
          ty: cs.h / 2 - fp.y * ns * vp.scale,
        }
      }
    }
    return vp
  }, [positionsRef])

  /** Release follow lock and commit the current visual position into viewport state. */
  const releaseFollow = useCallback(() => {
    if (followStnrRef.current === null) return
    const cur = effectiveViewport()
    setFollowStnrState(null)
    setViewport(cur)
  }, [effectiveViewport])

  // ---- Pointer interaction internals ----------------------------------------
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  // lastGestureMoved survives pointerup so the subsequent click handler can read it.
  const lastGestureMoved = useRef(false)
  const dragState = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    startTx: number
    startTy: number
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

  // ---- Event handlers -------------------------------------------------------
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (activePointers.current.size === 1) {
        lastGestureMoved.current = false
        const eff = effectiveViewport()
        dragState.current = {
          pointerId: e.pointerId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startTx: eff.tx,
          startTy: eff.ty,
        }
      } else if (activePointers.current.size === 2) {
        const pts = Array.from(activePointers.current.values())
        const dx = pts[0].x - pts[1].x
        const dy = pts[0].y - pts[1].y
        const dist = Math.hypot(dx, dy) || 1
        const mid = localPoint((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2)
        pinchState.current = {
          startDist: dist,
          startScale: effectiveViewport().scale,
          centerX: mid.x,
          centerY: mid.y,
        }
        dragState.current = null
      }
    },
    [effectiveViewport],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
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
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) lastGestureMoved.current = true
        if (followStnrRef.current) {
          setFollowStnrState(null)
        }
        setViewport((vp) => ({
          ...vp,
          tx: dragState.current!.startTx + dx,
          ty: dragState.current!.startTy + dy,
        }))
      }
    },
    [releaseFollow],
  )

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
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
  }, [])

  const onWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.0015)
      const lp = localPoint(e.clientX, e.clientY)
      if (followStnrRef.current) {
        setViewport((vp) => ({ ...vp, scale: clampZoom(vp.scale * factor) }))
      } else {
        setViewport((vp) => zoomAt(vp, clampZoom(vp.scale * factor), lp.x, lp.y))
      }
    },
    // localPoint reads containerRef which is a stable ref — no dep needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const cs = containerSizeRef.current
      if (e.key === "Escape") {
        if (followStnrRef.current) {
          releaseFollow()
          e.preventDefault()
        }
        return
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault()
        setViewport((vp) => zoomAt(vp, clampZoom(vp.scale + ZOOM_STEP), cs.w / 2, cs.h / 2))
        return
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault()
        setViewport((vp) => zoomAt(vp, clampZoom(vp.scale - ZOOM_STEP), cs.w / 2, cs.h / 2))
        return
      }
      if (e.key === "0") {
        e.preventDefault()
        setFollowStnrState(null)
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
    },
    [releaseFollow],
  )

  const wasDragging = useCallback(() => lastGestureMoved.current, [])

  return {
    viewport,
    followStnr,
    hoveredStnr,
    containerSize,
    naturalScale,
    viewportRef,
    followStnrRef,
    hoveredStnrRef,
    naturalScaleRef,
    containerSizeRef,
    containerRef,
    setViewport,
    setFollow,
    releaseFollow,
    setHoveredStnr,
    wasDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onWheel,
    onKeyDown,
  }
}
