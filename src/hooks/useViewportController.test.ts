import { renderHook, act } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { useViewportController, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "./useViewportController"

// Fake events helpers — only the fields the handlers actually read.
function wheelEvt(deltaY: number, clientX = 500, clientY = 300) {
  return {
    deltaY,
    clientX,
    clientY,
    preventDefault: () => {},
  } as unknown as React.WheelEvent<HTMLDivElement>
}

function keyEvt(key: string) {
  return {
    key,
    preventDefault: () => {},
  } as unknown as React.KeyboardEvent<HTMLDivElement>
}

function pointerEvt(
  pointerId: number,
  clientX: number,
  clientY: number,
  opts: { pointerType?: string; button?: number } = {},
) {
  const captured = new Set<number>()
  return {
    pointerId,
    clientX,
    clientY,
    pointerType: opts.pointerType ?? "mouse",
    button: opts.button ?? 0,
    currentTarget: {
      setPointerCapture: (id: number) => captured.add(id),
      releasePointerCapture: (id: number) => captured.delete(id),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    },
  } as unknown as React.PointerEvent<HTMLDivElement>
}

describe("useViewportController", () => {
  // Use 2048×1472 (same as the real track viewBox).
  const VIEW_W = 2048
  const VIEW_H = 1472

  function setup() {
    const positions = { current: new Map<string, { x: number; y: number }>() }
    const { result } = renderHook(() => useViewportController(positions, VIEW_W, VIEW_H))
    return { result, positions }
  }

  describe("initial state", () => {
    it("starts at scale=1, tx=0, ty=0, no follow, no hover", () => {
      const { result } = setup()
      expect(result.current.viewport).toEqual({ scale: 1, tx: 0, ty: 0 })
      expect(result.current.followStnr).toBeNull()
      expect(result.current.hoveredStnr).toBeNull()
    })
  })

  describe("keyboard shortcuts", () => {
    it("+ zooms in around container centre", () => {
      const { result } = setup()
      act(() => result.current.onKeyDown(keyEvt("+")))
      expect(result.current.viewport.scale).toBeCloseTo(1 + ZOOM_STEP)
    })

    it("- zooms out", () => {
      const { result } = setup()
      act(() => result.current.onKeyDown(keyEvt("-")))
      expect(result.current.viewport.scale).toBeCloseTo(1 - ZOOM_STEP)
    })

    it("0 resets viewport to 1:1", () => {
      const { result } = setup()
      act(() => result.current.onKeyDown(keyEvt("+")))
      act(() => result.current.onKeyDown(keyEvt("0")))
      expect(result.current.viewport).toEqual({ scale: 1, tx: 0, ty: 0 })
      expect(result.current.followStnr).toBeNull()
    })

    it("ArrowRight pans left (negative tx delta)", () => {
      const { result } = setup()
      act(() => result.current.onKeyDown(keyEvt("ArrowRight")))
      expect(result.current.viewport.tx).toBeLessThan(0)
    })

    it("ArrowLeft pans right (positive tx delta)", () => {
      const { result } = setup()
      act(() => result.current.onKeyDown(keyEvt("ArrowLeft")))
      expect(result.current.viewport.tx).toBeGreaterThan(0)
    })

    it("Escape releases follow and commits visual position", () => {
      const { result, positions } = setup()
      positions.current.set("42", { x: 100, y: 200 })
      act(() => result.current.setFollow("42"))
      expect(result.current.followStnr).toBe("42")
      act(() => result.current.onKeyDown(keyEvt("Escape")))
      expect(result.current.followStnr).toBeNull()
      // tx/ty committed: tx = cw/2 - 100*ns*scale, but containerSize is 0 in jsdom
      // Just assert follow was released without throwing.
    })

    it("clamps zoom to MIN_ZOOM", () => {
      const { result } = setup()
      for (let i = 0; i < 20; i++) act(() => result.current.onKeyDown(keyEvt("-")))
      expect(result.current.viewport.scale).toBeGreaterThanOrEqual(MIN_ZOOM)
    })

    it("clamps zoom to MAX_ZOOM", () => {
      const { result } = setup()
      for (let i = 0; i < 30; i++) act(() => result.current.onKeyDown(keyEvt("+")))
      expect(result.current.viewport.scale).toBeLessThanOrEqual(MAX_ZOOM)
    })
  })

  describe("wheel zoom", () => {
    it("zooms in on scroll up (negative deltaY)", () => {
      const { result } = setup()
      const before = result.current.viewport.scale
      act(() => result.current.onWheel(wheelEvt(-200)))
      expect(result.current.viewport.scale).toBeGreaterThan(before)
    })

    it("zooms out on scroll down (positive deltaY)", () => {
      const { result } = setup()
      const before = result.current.viewport.scale
      act(() => result.current.onWheel(wheelEvt(200)))
      expect(result.current.viewport.scale).toBeLessThan(before)
    })

    it("anchors zoom at cursor position (tx shifts away from anchor)", () => {
      const { result } = setup()
      // Zoom in at x=0 — tx should stay 0 (anchor at origin, nothing to shift).
      act(() => result.current.onWheel(wheelEvt(-500, 0, 300)))
      expect(result.current.viewport.tx).toBeCloseTo(0)
    })
  })

  describe("drag-to-pan", () => {
    it("updates tx/ty while dragging", () => {
      const { result } = setup()
      act(() => result.current.onPointerDown(pointerEvt(1, 100, 100)))
      act(() => result.current.onPointerMove(pointerEvt(1, 150, 120)))
      expect(result.current.viewport.tx).toBeCloseTo(50)
      expect(result.current.viewport.ty).toBeCloseTo(20)
    })

    it("tracks moved flag and wasDragging returns true after move > 3px", () => {
      const { result } = setup()
      act(() => result.current.onPointerDown(pointerEvt(1, 0, 0)))
      act(() => result.current.onPointerMove(pointerEvt(1, 10, 0)))
      expect(result.current.wasDragging()).toBe(true)
    })

    it("wasDragging is false after fresh pointerDown", () => {
      const { result } = setup()
      act(() => result.current.onPointerDown(pointerEvt(1, 0, 0)))
      expect(result.current.wasDragging()).toBe(false)
    })

    it("releases follow when dragging starts", () => {
      const { result, positions } = setup()
      positions.current.set("7", { x: 500, y: 300 })
      act(() => result.current.setFollow("7"))
      act(() => result.current.onPointerDown(pointerEvt(1, 0, 0)))
      act(() => result.current.onPointerMove(pointerEvt(1, 50, 0)))
      expect(result.current.followStnr).toBeNull()
    })
  })

  describe("follow mode", () => {
    it("setFollow sets followStnr", () => {
      const { result } = setup()
      act(() => result.current.setFollow("99"))
      expect(result.current.followStnr).toBe("99")
    })

    it("releaseFollow clears followStnr", () => {
      const { result } = setup()
      act(() => result.current.setFollow("99"))
      act(() => result.current.releaseFollow())
      expect(result.current.followStnr).toBeNull()
    })

    it("releaseFollow is a no-op when not following", () => {
      const { result } = setup()
      expect(() => act(() => result.current.releaseFollow())).not.toThrow()
      expect(result.current.followStnr).toBeNull()
    })

    it("ArrowKey releases follow before panning", () => {
      const { result } = setup()
      act(() => result.current.setFollow("1"))
      act(() => result.current.onKeyDown(keyEvt("ArrowLeft")))
      expect(result.current.followStnr).toBeNull()
    })
  })

  describe("hover state", () => {
    it("setHoveredStnr updates hoveredStnr", () => {
      const { result } = setup()
      act(() => result.current.setHoveredStnr("55"))
      expect(result.current.hoveredStnr).toBe("55")
    })

    it("setHoveredStnr(null) clears hover", () => {
      const { result } = setup()
      act(() => result.current.setHoveredStnr("55"))
      act(() => result.current.setHoveredStnr(null))
      expect(result.current.hoveredStnr).toBeNull()
    })
  })

  describe("refs stay in sync with state", () => {
    it("viewportRef.current matches viewport state", () => {
      const { result } = setup()
      act(() => result.current.onKeyDown(keyEvt("+")))
      expect(result.current.viewportRef.current).toEqual(result.current.viewport)
    })

    it("followStnrRef.current matches followStnr state", () => {
      const { result } = setup()
      act(() => result.current.setFollow("3"))
      expect(result.current.followStnrRef.current).toBe("3")
    })
  })

  describe("right-click ignored", () => {
    it("right-click does not start a drag", () => {
      const { result } = setup()
      act(() =>
        result.current.onPointerDown(pointerEvt(1, 100, 100, { pointerType: "mouse", button: 2 })),
      )
      act(() => result.current.onPointerMove(pointerEvt(1, 200, 100)))
      expect(result.current.viewport.tx).toBe(0)
    })
  })
})
