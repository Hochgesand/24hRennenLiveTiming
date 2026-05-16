import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TrackCarMarkers } from "./TrackMapPanel"

function mockDriver(
  overrides: Partial<{
    startingNumber: string
    visible: boolean
    distanceM: number
    pathFraction: number
    name: string
    team: string
    position: string
    className: string
    anchorDistanceM: number
    anchorTimeMs: number
    predictedVelocityMps: number
    trackLengthM: number
    maxProjectedDistanceM: number
  }> = {},
) {
  return {
    startingNumber: "130",
    visible: true,
    distanceM: 500,
    pathFraction: 0.5,
    name: "Mapelli",
    team: "ABT",
    position: "1",
    className: "SP 9",
    anchorDistanceM: 400,
    anchorTimeMs: 0,
    predictedVelocityMps: 80,
    trackLengthM: 1000,
    maxProjectedDistanceM: 600,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("TrackCarMarkers", () => {
  it("renders visible drivers with accessible labels", () => {
    render(
      <svg>
        <TrackCarMarkers
          drivers={[
            mockDriver(),
            mockDriver({
              startingNumber: "8",
              visible: false,
              distanceM: 0,
              pathFraction: 0,
              name: "Hidden",
              team: "",
              position: "",
              className: "",
            }),
          ]}
          pathLengthForDriver={(driver) => driver.distanceM}
          getPointAtLength={(len) => ({ x: len, y: len })}
        />
      </svg>,
    )

    expect(screen.getByLabelText(/#130.*Mapelli/)).toBeTruthy()
    expect(screen.queryByLabelText(/#8/)).toBeNull()
  })

  it("renders path length from pathLengthForDriver (constant-velocity display)", () => {
    const pathLengths = [100, 150, 200, 250]
    const cxValues: number[] = []

    for (const len of pathLengths) {
      const { unmount } = render(
        <svg>
          <TrackCarMarkers
            drivers={[mockDriver({ startingNumber: "77", name: "Test" })]}
            pathLengthForDriver={() => len}
            getPointAtLength={(l) => ({ x: l, y: 0 })}
          />
        </svg>,
      )
      const circle = document.querySelector("circle")
      if (circle) {
        cxValues.push(Number(circle.getAttribute("cx")))
      }
      unmount()
    }

    expect(cxValues).toEqual(pathLengths)
  })
})
