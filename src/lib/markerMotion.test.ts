import { describe, expect, it } from "vitest"

import {
  advanceMarkerState,
  DEFAULT_CATCH_UP_SEC,
  shortestSignedDelta,
  wrapPathLength,
} from "./markerMotion"

const TOTAL = 1000

describe("wrapPathLength", () => {
  it("wraps negative and overflow lengths", () => {
    expect(wrapPathLength(1050, TOTAL)).toBe(50)
    expect(wrapPathLength(-10, TOTAL)).toBe(990)
  })
})

describe("shortestSignedDelta", () => {
  it("picks the short way across the seam", () => {
    expect(shortestSignedDelta(990, 10, TOTAL)).toBe(20)
    expect(shortestSignedDelta(10, 990, TOTAL)).toBe(-20)
  })
})

describe("advanceMarkerState", () => {
  it("integrates at constant velocity between anchor updates", () => {
    let state = advanceMarkerState(undefined, {
      targetLen: 100,
      predictedVel: 50,
      anchorTimeMs: 1,
      dtSec: 0,
      totalLength: TOTAL,
      catchUpSec: DEFAULT_CATCH_UP_SEC,
    })
    expect(state.displayedLen).toBe(100)
    expect(state.heldVelocity).toBe(50)

    state = advanceMarkerState(state, {
      targetLen: 110,
      predictedVel: 50,
      anchorTimeMs: 1,
      dtSec: 0.1,
      totalLength: TOTAL,
      catchUpSec: DEFAULT_CATCH_UP_SEC,
    })
    expect(state.displayedLen).toBeCloseTo(105, 5)
    expect(state.heldVelocity).toBe(50)

    state = advanceMarkerState(state, {
      targetLen: 120,
      predictedVel: 50,
      anchorTimeMs: 1,
      dtSec: 0.1,
      totalLength: TOTAL,
      catchUpSec: DEFAULT_CATCH_UP_SEC,
    })
    expect(state.displayedLen).toBeCloseTo(110, 5)
  })

  it("recomputes velocity on a fresh anchor for linear catch-up", () => {
    const state = advanceMarkerState(
      {
        displayedLen: 100,
        heldVelocity: 50,
        anchorTimeMs: 1,
      },
      {
        targetLen: 130,
        predictedVel: 50,
        anchorTimeMs: 2,
        dtSec: 0,
        totalLength: TOTAL,
        catchUpSec: 1,
      },
    )
    expect(state.heldVelocity).toBe(80) // 50 + (130 - 100) / 1
    expect(state.anchorTimeMs).toBe(2)

    const afterOneSec = advanceMarkerState(state, {
      targetLen: 180,
      predictedVel: 50,
      anchorTimeMs: 2,
      dtSec: 1,
      totalLength: TOTAL,
      catchUpSec: 1,
    })
    expect(afterOneSec.displayedLen).toBeCloseTo(180, 5) // 100 + 80 * 1
    expect(afterOneSec.heldVelocity).toBe(80)
  })

  it("uses shortest signed delta across the seam on anchor update", () => {
    const state = advanceMarkerState(
      {
        displayedLen: 990,
        heldVelocity: 10,
        anchorTimeMs: 1,
      },
      {
        targetLen: 10,
        predictedVel: 50,
        anchorTimeMs: 2,
        dtSec: 0,
        totalLength: TOTAL,
        catchUpSec: 1,
      },
    )
    // error = +20 (forward across seam), not -980
    expect(state.heldVelocity).toBe(70) // 50 + 20 / 1
  })
})
