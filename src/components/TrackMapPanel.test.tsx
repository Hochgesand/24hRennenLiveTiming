import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TrackCarMarkers } from "./TrackMapPanel"

describe("TrackCarMarkers", () => {
  it("renders visible drivers with accessible labels", () => {
    render(
      <svg>
        <TrackCarMarkers
          drivers={[
            {
              startingNumber: "130",
              visible: true,
              distanceM: 500,
              pathFraction: 0.5,
              name: "Mapelli",
              team: "ABT",
              position: "1",
              className: "SP 9",
            },
            {
              startingNumber: "8",
              visible: false,
              distanceM: 0,
              pathFraction: 0,
              name: "Hidden",
              team: "",
              position: "",
              className: "",
            },
          ]}
          pathLengthForDriver={(driver) => driver.distanceM}
          getPointAtLength={(len) => ({ x: len, y: len })}
        />
      </svg>,
    )

    expect(screen.getByLabelText(/#130.*Mapelli/)).toBeTruthy()
    expect(screen.queryByLabelText(/#8/)).toBeNull()
  })
})
