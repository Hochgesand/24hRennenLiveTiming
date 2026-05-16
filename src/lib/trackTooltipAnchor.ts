export const TOOLTIP_W = 210
export const TOOLTIP_H = 100
export const TOOLTIP_OFFSET = 14

export interface TooltipPosition {
  left: number
  top: number
}

/**
 * Maps a marker's SVG-coord position to an edge-flipped CSS position for the
 * tooltip box. Pure function — no DOM access required.
 *
 * @param svgPos    - Marker position in SVG viewBox units (from getPointAtLength).
 * @param ns        - Natural scale: CSS pixels per SVG unit (letterbox "meet" scale).
 * @param effTx     - Effective viewport translateX in CSS pixels.
 * @param effTy     - Effective viewport translateY in CSS pixels.
 * @param vpScale   - Viewport zoom multiplier.
 * @param cw        - Container width in CSS pixels.
 * @param ch        - Container height in CSS pixels.
 * @param tipW      - Tooltip box width (defaults to TOOLTIP_W).
 * @param tipH      - Tooltip box height (defaults to TOOLTIP_H).
 */
export function trackTooltipAnchor(
  svgPos: { x: number; y: number },
  ns: number,
  effTx: number,
  effTy: number,
  vpScale: number,
  cw: number,
  ch: number,
  tipW = TOOLTIP_W,
  tipH = TOOLTIP_H,
): TooltipPosition {
  const px = svgPos.x * ns * vpScale + effTx
  const py = svgPos.y * ns * vpScale + effTy
  const flipX = px + TOOLTIP_OFFSET + tipW > cw
  const flipY = py + TOOLTIP_OFFSET + tipH > ch
  return {
    left: Math.max(2, flipX ? px - tipW - TOOLTIP_OFFSET : px + TOOLTIP_OFFSET),
    top: Math.max(2, flipY ? py - tipH - TOOLTIP_OFFSET : py + TOOLTIP_OFFSET),
  }
}
