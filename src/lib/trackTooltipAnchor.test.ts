import { describe, it, expect } from "vitest"
import {
  trackTooltipAnchor,
  TOOLTIP_W,
  TOOLTIP_H,
  TOOLTIP_OFFSET,
} from "./trackTooltipAnchor"

describe("trackTooltipAnchor", () => {
  // Helper: unit scale, no viewport transform, large container (plenty of space).
  const simple = (svgX: number, svgY: number, cw = 2000, ch = 2000) =>
    trackTooltipAnchor({ x: svgX, y: svgY }, 1, 0, 0, 1, cw, ch)

  it("places tooltip to the right and below when space is available", () => {
    const pos = simple(100, 100)
    expect(pos.left).toBe(100 + TOOLTIP_OFFSET)
    expect(pos.top).toBe(100 + TOOLTIP_OFFSET)
  })

  it("flips horizontally when near the right edge", () => {
    // px = 900; 900 + OFFSET(14) + TOOLTIP_W(210) = 1124 > 1000 → flip left
    const pos = simple(900, 100, 1000, 2000)
    expect(pos.left).toBe(900 - TOOLTIP_W - TOOLTIP_OFFSET)
  })

  it("does not flip horizontally when exactly fitting", () => {
    // px = 900; 900 + 14 + 210 = 1124 > 1000 → still flips.
    // px = 776; 776 + 14 + 210 = 1000 → just fits, no flip.
    const pos = simple(776, 100, 1000, 2000)
    expect(pos.left).toBe(776 + TOOLTIP_OFFSET)
  })

  it("flips vertically when near the bottom edge", () => {
    // py = 900; 900 + 14 + TOOLTIP_H(100) = 1014 > 1000 → flip up
    const pos = simple(100, 900, 2000, 1000)
    expect(pos.top).toBe(900 - TOOLTIP_H - TOOLTIP_OFFSET)
  })

  it("flips both axes near the bottom-right corner", () => {
    const pos = simple(900, 900, 1000, 1000)
    expect(pos.left).toBe(900 - TOOLTIP_W - TOOLTIP_OFFSET)
    expect(pos.top).toBe(900 - TOOLTIP_H - TOOLTIP_OFFSET)
  })

  it("applies naturalScale and viewport transform correctly", () => {
    // SVG (50, 50), ns=2, tx=10, ty=20, scale=1 → pixel (110, 120)
    const pos = trackTooltipAnchor({ x: 50, y: 50 }, 2, 10, 20, 1, 2000, 2000)
    expect(pos.left).toBe(110 + TOOLTIP_OFFSET)
    expect(pos.top).toBe(120 + TOOLTIP_OFFSET)
  })

  it("applies viewport scale correctly", () => {
    // SVG (100, 100), ns=1, tx=0, ty=0, scale=2 → pixel (200, 200)
    const pos = trackTooltipAnchor({ x: 100, y: 100 }, 1, 0, 0, 2, 2000, 2000)
    expect(pos.left).toBe(200 + TOOLTIP_OFFSET)
    expect(pos.top).toBe(200 + TOOLTIP_OFFSET)
  })

  it("clamps to minimum 2px on left when anchor is at origin", () => {
    // px=0, py=0: left = max(2, 0 + OFFSET) = OFFSET (>2, no clamp needed here)
    // Force a clamp: negative pixel coordinates via negative tx
    const pos = trackTooltipAnchor({ x: 0, y: 0 }, 1, -100, -100, 1, 1000, 1000)
    // px = -100: flip applies (−100 + 14 + 210 = 124 < 1000 → no flip)
    // left = max(2, -100 + 14) = max(2, -86) = 2
    expect(pos.left).toBe(2)
    expect(pos.top).toBe(2)
  })

  it("respects custom tip dimensions for edge detection", () => {
    // px=950, default TOOLTIP_W: 950+14+210=1174 > 1000 → flips
    // custom tipW=20:             950+14+20=984 < 1000 → no flip
    const posDefault = trackTooltipAnchor({ x: 950, y: 100 }, 1, 0, 0, 1, 1000, 2000)
    const posSmall = trackTooltipAnchor({ x: 950, y: 100 }, 1, 0, 0, 1, 1000, 2000, 20, 20)
    expect(posDefault.left).toBe(950 - TOOLTIP_W - TOOLTIP_OFFSET)
    expect(posSmall.left).toBe(950 + TOOLTIP_OFFSET)
  })
})
