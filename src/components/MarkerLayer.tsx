import { memo, type MouseEvent, type PointerEvent } from "react"

interface MarkerLayerProps {
  visibleStnrs: string[]
  followStnr: string | null
  hoveredStnr: string | null
  assignRef: (stnr: string) => (el: SVGGElement | null) => void
  onPointerOver: (e: PointerEvent<SVGGElement>) => void
  onPointerOut: (e: PointerEvent<SVGGElement>) => void
  onClick: (e: MouseEvent<SVGGElement>) => void
}

function areEqual(prev: MarkerLayerProps, next: MarkerLayerProps): boolean {
  if (prev.followStnr !== next.followStnr) return false
  if (prev.hoveredStnr !== next.hoveredStnr) return false
  if (prev.visibleStnrs.length !== next.visibleStnrs.length) return false
  for (let i = 0; i < prev.visibleStnrs.length; i++) {
    if (prev.visibleStnrs[i] !== next.visibleStnrs[i]) return false
  }
  return true
}

/**
 * Renders one <g data-stnr> per visible car. Memoized on the STNR set plus
 * hover/follow identity — never re-renders mid-animation-frame.
 *
 * Pointer handlers are attached once at the group level via event delegation;
 * individual markers carry no listeners of their own.
 */
export const MarkerLayer = memo(function MarkerLayer({
  visibleStnrs,
  followStnr,
  hoveredStnr,
  assignRef,
  onPointerOver,
  onPointerOut,
  onClick,
}: MarkerLayerProps) {
  return (
    <g
      className="track-car-markers"
      aria-label="Cars on track"
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      {visibleStnrs.map((stnr) => {
        const isFollowed = stnr === followStnr
        const isHovered = stnr === hoveredStnr
        return (
          <g
            key={stnr}
            ref={assignRef(stnr)}
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
  )
},
areEqual)
