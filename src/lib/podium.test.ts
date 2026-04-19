import { describe, expect, it } from "vitest"

import { getPodiumRows } from "./podium"

describe("getPodiumRows", () => {
  it("returns three nulls for undefined or empty input", () => {
    expect(getPodiumRows(undefined)).toEqual([null, null, null])
    expect(getPodiumRows([])).toEqual([null, null, null])
  })

  it("sorts by POSITION ascending and returns top three", () => {
    const rows = [
      { POSITION: 3, NAME: "Third" },
      { POSITION: 1, NAME: "First" },
      { POSITION: 2, NAME: "Second" },
      { POSITION: 4, NAME: "Fourth" },
    ]
    const [p1, p2, p3] = getPodiumRows(rows)
    expect(p1?.NAME).toBe("First")
    expect(p2?.NAME).toBe("Second")
    expect(p3?.NAME).toBe("Third")
  })

  it("accepts POSITION as string", () => {
    const rows = [{ POSITION: "2", NAME: "B" }, { POSITION: "1", NAME: "A" }]
    const [p1, p2, p3] = getPodiumRows(rows)
    expect(p1?.NAME).toBe("A")
    expect(p2?.NAME).toBe("B")
    expect(p3).toBeNull()
  })

  it("pads with null when fewer than three valid rows", () => {
    const rows = [{ POSITION: 1, NAME: "Solo" }]
    expect(getPodiumRows(rows)).toEqual([{ POSITION: 1, NAME: "Solo" }, null, null])
  })

  it("skips rows without parseable POSITION", () => {
    const rows = [{ NAME: "Nope" }, { POSITION: 1, NAME: "Yes" }]
    const [p1] = getPodiumRows(rows)
    expect(p1?.NAME).toBe("Yes")
  })
})
