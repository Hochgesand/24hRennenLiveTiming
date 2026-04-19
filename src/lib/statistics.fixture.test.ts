/**
 * Smoke test for the statistics derive helpers against the captured fixture
 * (PRD-statistics-cockpit.md §"Test data & determinism" item 1).
 *
 * Loads `src/lib/__fixtures__/pid9002.event50.json` and runs every derive
 * helper (`classKpis`, `bestLapsByClass`, `sectorHeatmap`, `enrichedLeading`)
 * once. Asserts the headline shape only — exhaustive per-helper coverage
 * lives in the dedicated `statistics.test.ts` files.
 */
import { describe, expect, it } from "vitest"

import {
  bestLapsByClass,
  classKpis,
  enrichedLeading,
  sectorHeatmap,
} from "./statistics"
import type { Pid9002Frame } from "./types"
import fixture from "./__fixtures__/pid9002.event50.json"

const stats = fixture as unknown as Pid9002Frame

describe("statistics derive helpers — pid9002.event50.json fixture", () => {
  it("classKpis returns a populated fastest lap from the fixture", () => {
    const kpis = classKpis(stats)
    expect(kpis.fastestLap).not.toBeNull()
    expect(kpis.fastestLap!.seconds).toBeGreaterThan(0)
    expect(kpis.activeClasses).toBe(6)
  })

  it("bestLapsByClass returns 6 rows (TOTAL stripped)", () => {
    const rows = bestLapsByClass(stats)
    expect(rows).toHaveLength(6)
  })

  it("sectorHeatmap reports 4 sectors (Nordschleife layout)", () => {
    const heatmap = sectorHeatmap(stats)
    expect(heatmap.sectorCount).toBe(4)
  })

  it("enrichedLeading returns 6 rows (TOTAL stripped)", () => {
    const data = enrichedLeading(stats)
    expect(data.rows).toHaveLength(6)
  })
})
