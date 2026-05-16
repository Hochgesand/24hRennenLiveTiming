import { describe, expect, it } from "vitest"

import { SECTOR_END_POINTS } from "@/assets/nuerburgring24h"
import type { Pid0Frame } from "@/domain"

import {
  distanceToPathLength,
  resolveSectorGeometry,
  resolveTimingSectorLengths,
  type SectorGeometry,
} from "./trackGeometry"

const VISUAL_BOUNDARIES = [80, 120, 180, 400, 520, 650, 730, 860, 1000]

function geometryFromBoundaries(boundaries: number[]): SectorGeometry {
  const totalLength = boundaries[boundaries.length - 1]
  return {
    totalLength,
    markers: boundaries.map((x) => ({ x, y: 0 })),
    sectors: boundaries.map((curr, i) => {
      const prev = i === 0 ? boundaries[boundaries.length - 1] : boundaries[i - 1]
      if (prev <= curr) {
        return [{ startLen: prev, endLen: curr }]
      }
      return [
        { startLen: prev, endLen: totalLength },
        { startLen: 0, endLen: curr },
      ]
    }),
  }
}

function fakeLandmarkPath(boundaries: number[]): SVGPathElement {
  return {
    getTotalLength: () => boundaries[boundaries.length - 1],
    getPointAtLength: (len: number) => {
      const index = boundaries.findIndex((boundary) => Math.abs(boundary - len) < 0.25)
      if (index >= 0) {
        return { x: SECTOR_END_POINTS[index].x, y: SECTOR_END_POINTS[index].y }
      }
      return { x: -10_000 + len, y: -10_000 }
    },
  } as SVGPathElement
}

function session(overrides: Partial<Pid0Frame> = {}): Pid0Frame {
  return {
    PID: "0",
    TRACKLENGTH: 1200,
    S1L: 100,
    S2L: 100,
    S3L: 100,
    S4L: 400,
    S5L: 100,
    S6L: 100,
    S7L: 100,
    S8L: 100,
    S9L: 100,
    ...overrides,
  }
}

describe("resolveSectorGeometry", () => {
  it("uses fixed SVG landmark spans even when feed sectors are available", () => {
    const geometry = resolveSectorGeometry(
      fakeLandmarkPath(VISUAL_BOUNDARIES),
      session({
        TRACKLENGTH: 1000,
        S1L: 100,
        S2L: 100,
        S3L: 100,
        S4L: 100,
        S5L: 100,
        S6L: 100,
        S7L: 100,
        S8L: 100,
        S9L: 200,
      }),
    )

    expect(geometry.sectors[0]).toEqual([
      { startLen: 1000, endLen: 1000 },
      { startLen: 0, endLen: 80 },
    ])
    expect(geometry.sectors[3]).toEqual([{ startLen: 180, endLen: 400 }])
  })
})

describe("distanceToPathLength", () => {
  it("maps timing-sector boundaries onto visual-sector boundaries", () => {
    const geometry = geometryFromBoundaries(VISUAL_BOUNDARIES)
    const timing = resolveTimingSectorLengths(session())

    expect(timing).not.toBeNull()
    expect(distanceToPathLength(300, timing!, geometry)).toBe(180)
  })

  it("maps intra-sector progress across the whole matching visual span", () => {
    const geometry = geometryFromBoundaries(VISUAL_BOUNDARIES)
    const timing = resolveTimingSectorLengths(session())

    expect(timing).not.toBeNull()
    expect(distanceToPathLength(500, timing!, geometry)).toBe(290)
  })

  it("maps lap start and lap end to Start/Ziel", () => {
    const geometry = geometryFromBoundaries(VISUAL_BOUNDARIES)
    const timing = resolveTimingSectorLengths(session())

    expect(timing).not.toBeNull()
    expect(distanceToPathLength(0, timing!, geometry)).toBe(1000)
    expect(distanceToPathLength(1200, timing!, geometry)).toBe(1000)
  })
})

describe("resolveTimingSectorLengths", () => {
  it("reuses cached valid sector lengths before falling back to equal sectors", () => {
    const cached = resolveTimingSectorLengths(session())
    const incomplete = session({ S4L: undefined })

    expect(cached).not.toBeNull()
    expect(resolveTimingSectorLengths(incomplete, cached)).toBe(cached)

    const fallback = resolveTimingSectorLengths(incomplete)

    expect(fallback?.trackLengthM).toBe(1200)
    expect(fallback?.sectorLengthsM).toEqual(Array.from({ length: 9 }, () => 1200 / 9))
  })
})
