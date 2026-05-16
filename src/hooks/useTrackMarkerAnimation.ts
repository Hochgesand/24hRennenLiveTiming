import { useCallback, useEffect, useRef, useState } from "react"

import {
  distanceToPathLength,
  type SectorGeometry,
  type TimingSectorLengths,
} from "@/lib/trackGeometry"
import {
  computeTrackDrivers,
  type TrackDriverMarker,
  type TrackTimingHistory,
} from "@/lib/trackTiming"
import { trackTooltipAnchor } from "@/lib/trackTooltipAnchor"
import type { Pid0Frame } from "@/lib/types"
import type { ViewportState } from "./useViewportController"

interface UseTrackMarkerAnimationParams {
  geometry: SectorGeometry | null
  timingSectors: TimingSectorLengths | null
  pathElement: SVGPathElement | null
  sessionMeta: Pid0Frame | null | undefined
  trackState: unknown
  remoteTimeDiffMs: number
  history: TrackTimingHistory

  // DOM refs
  svgRef: React.RefObject<SVGSVGElement | null>
  markerRefs: React.RefObject<Map<string, SVGGElement>>
  tooltipRef: React.RefObject<HTMLDivElement | null>

  // Shared data refs (written here, read by viewport controller / tooltip)
  positionsRef: React.RefObject<Map<string, { x: number; y: number }>>
  driversRef: React.RefObject<Map<string, TrackDriverMarker>>

  // Viewport refs (read-only here — written by useViewportController)
  viewportRef: React.RefObject<ViewportState>
  followStnrRef: React.RefObject<string | null>
  hoveredStnrRef: React.RefObject<string | null>
  naturalScaleRef: React.RefObject<number>
  containerSizeRef: React.RefObject<{ w: number; h: number }>
}

interface UseTrackMarkerAnimationResult {
  /** React state — updated only when the set of visible STNRs changes. */
  visibleStnrs: string[]
  /** Stable ref-callback factory for attaching <g> elements to markerRefs. */
  markerRefFor: (stnr: string) => (el: SVGGElement | null) => void
}

/**
 * Runs a single requestAnimationFrame loop that:
 *   1. Calls computeTrackDrivers and maps each visible car to an SVG position.
 *   2. Writes transform="translate(x y)" directly to each marker <g> element.
 *   3. Updates the SVG viewport transform for follow-car mode.
 *   4. Pins the tooltip to the hovered car's screen position.
 *   5. Updates visibleStnrs React state only when the set membership changes.
 *   6. Auto-pauses (stops scheduling the next rAF) when no markers are visible.
 */
export function useTrackMarkerAnimation({
  geometry,
  timingSectors,
  pathElement,
  sessionMeta,
  trackState,
  remoteTimeDiffMs,
  history,
  svgRef,
  markerRefs,
  tooltipRef,
  positionsRef,
  driversRef,
  viewportRef,
  followStnrRef,
  hoveredStnrRef,
  naturalScaleRef,
  containerSizeRef,
}: UseTrackMarkerAnimationParams): UseTrackMarkerAnimationResult {
  const [visibleStnrs, setVisibleStnrs] = useState<string[]>([])

  // Factory-cached ref callbacks — same closure reused per STNR so React sees
  // a stable ref prop and does not unmount/remount the <g> unnecessarily.
  const markerRefCallbacks = useRef<Map<string, (el: SVGGElement | null) => void>>(new Map())

  const markerRefFor = useCallback(
    (stnr: string): ((el: SVGGElement | null) => void) => {
      const existing = markerRefCallbacks.current.get(stnr)
      if (existing) return existing
      const cb = (el: SVGGElement | null) => {
        if (el) markerRefs.current.set(stnr, el)
        else markerRefs.current.delete(stnr)
      }
      markerRefCallbacks.current.set(stnr, cb)
      return cb
    },
    [markerRefs],
  )

  useEffect(() => {
    if (!geometry || !timingSectors || !pathElement || !svgRef.current) return

    let frameId = 0
    let lastStnrKey = ""

    const tick = () => {
      const drivers = computeTrackDrivers({
        session: sessionMeta ?? null,
        trackState: trackState as import("@/lib/types").WireScalar | undefined,
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
        const p = geometry.pointAtLength(len)
        positions.set(d.startingNumber, { x: p.x, y: p.y })
        visibleNow.push(d.startingNumber)

        const g = markerRefs.current.get(d.startingNumber)
        if (g) g.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`)
      }

      // Update visible-set React state only on membership change.
      const key = visibleNow.join(",")
      if (key !== lastStnrKey) {
        lastStnrKey = key
        setVisibleStnrs(visibleNow)
      }

      const svg = svgRef.current
      const vp = viewportRef.current
      const ns = naturalScaleRef.current
      const cs = containerSizeRef.current
      const fStnr = followStnrRef.current

      // Write SVG viewport transform.
      if (svg) {
        if (fStnr) {
          const fp = positions.get(fStnr)
          if (fp) {
            const tx = cs.w / 2 - fp.x * ns * vp.scale
            const ty = cs.h / 2 - fp.y * ns * vp.scale
            svg.style.transform = `translate(${tx}px,${ty}px) scale(${vp.scale})`
          }
        } else {
          svg.style.transform = `translate(${vp.tx}px,${vp.ty}px) scale(${vp.scale})`
        }
      }

      // Pin tooltip to hovered car.
      const hStnr = hoveredStnrRef.current
      const tip = tooltipRef.current
      if (hStnr && tip) {
        const hp = positions.get(hStnr)
        if (hp) {
          const effTx = fStnr
            ? cs.w / 2 - (positions.get(fStnr)?.x ?? hp.x) * ns * vp.scale
            : vp.tx
          const effTy = fStnr
            ? cs.h / 2 - (positions.get(fStnr)?.y ?? hp.y) * ns * vp.scale
            : vp.ty
          const tipW = tip.offsetWidth || undefined
          const tipH = tip.offsetHeight || undefined
          const { left, top } = trackTooltipAnchor(hp, ns, effTx, effTy, vp.scale, cs.w, cs.h, tipW, tipH)
          tip.style.left = `${left}px`
          tip.style.top = `${top}px`
        }
      }

      // Auto-pause when nothing is visible — resumes when session deps change.
      if (visibleNow.length > 0) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [
    geometry,
    timingSectors,
    pathElement,
    sessionMeta,
    trackState,
    remoteTimeDiffMs,
    history,
    svgRef,
    markerRefs,
    tooltipRef,
    positionsRef,
    driversRef,
    viewportRef,
    followStnrRef,
    hoveredStnrRef,
    naturalScaleRef,
    containerSizeRef,
  ])

  return { visibleStnrs, markerRefFor }
}
