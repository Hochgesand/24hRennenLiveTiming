/**
 * Focus-ring contract test (PRD-statistics-cockpit.md §"Accessibility" item 2).
 *
 * Picks ONE representative interactive element per shell + stats-band component
 * and asserts that the shared `.focus-ring` utility class is present in the
 * className list. The utility itself (defined in `src/index.css` `@layer
 * utilities`) wraps `focus-visible:outline outline-1 outline-offset-2` plus
 * the `outline-variant` 30 % token.
 *
 * Per-element rendering / behaviour is exhaustively covered by the dedicated
 * `*.test.tsx` files; this test only guards the keyboard-focus contract so
 * removing the class from any of these elements lights up CI.
 */
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Pid9002Frame } from "@/domain"
import type { Breakpoint } from "@/hooks/useBreakpoint"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"

let mockBreakpoint: Breakpoint = "desktop"
vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpoint: () => mockBreakpoint,
}))

import { BestLapPerClassChart } from "./stats/BestLapPerClassChart"
import { LeadingTable } from "./stats/LeadingTable"
import { SectorHeatmap } from "./stats/SectorHeatmap"
import { StatsClassFilter } from "./stats/StatsClassFilter"
import { BrandTopBar } from "./shell/BrandTopBar"
import { MobileBottomNav } from "./shell/MobileBottomNav"
import { SideNav } from "./shell/SideNav"
import { StatsSubTabs } from "./shell/StatsSubTabs"

const STATS = {
  PID: "9002",
  LEADING: [
    { CLASS: "SP9", NR: "911", LAPS: "120", GAP: "", SUM: "16:41:22.401", FROMLAP: 100 },
    { CLASS: "SP-X", NR: "706", LAPS: "118", GAP: "+2 Laps", SUM: "16:42:01.884", FROMLAP: 95 },
  ],
  BESTLAPS: [
    { CLASS: "SP9", NR: "911", LAPTIME: "8:08.500", DAYTIME: "13:22:11" },
    { CLASS: "SP-X", NR: "706", LAPTIME: "8:10.200", DAYTIME: "11:48:02" },
  ],
  BESTSECTORS: [
    { CLASS: "SP9", S1: "2:01.500", S2: "2:14.300", S3: "2:02.700", S4: "1:50.000", LAPTIME: "8:08.500" },
    { CLASS: "SP-X", S1: "2:01.700", S2: "2:14.800", S3: "2:03.200", S4: "1:50.500", LAPTIME: "8:10.200" },
  ],
} as unknown as Pid9002Frame

function expectFocusRing(el: Element | null, label: string): void {
  expect(el, label).not.toBeNull()
  expect(el!.className, label).toContain("focus-ring")
}

describe("Focus-ring contract", () => {
  const initialLive = useLiveStore.getState()
  const initialFilters = useFilterStore.getState()

  beforeEach(() => {
    mockBreakpoint = "desktop"
    useLiveStore.setState({
      ...initialLive,
      statistics: STATS,
      sessionMeta: null,
    })
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(),
    })
  })

  afterEach(() => {
    mockBreakpoint = "desktop"
    useLiveStore.setState({
      ...initialLive,
      statistics: null,
      sessionMeta: null,
    })
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(),
    })
  })

  it("BrandTopBar — Search / Notifications / Settings buttons carry .focus-ring", () => {
    const { container } = render(<BrandTopBar />)
    const search = container.querySelector('button[data-todo="search"]')
    const notifications = container.querySelector(
      'button[data-todo="notifications"]'
    )
    const buttons = container.querySelectorAll("button")
    const settings = buttons[buttons.length - 1]
    expectFocusRing(search, "BrandTopBar Search")
    expectFocusRing(notifications, "BrandTopBar Notifications")
    expectFocusRing(settings, "BrandTopBar Settings")
  })

  it("SideNav — at least one nav button carries .focus-ring", () => {
    const { container } = render(
      <SideNav activeTab="stats" onSelect={() => {}} />
    )
    const buttons = container.querySelectorAll("button")
    expectFocusRing(buttons[0], "SideNav first nav button")
  })

  it("MobileBottomNav — every tab button carries .focus-ring", () => {
    const { container } = render(
      <MobileBottomNav active="stats" onSelect={() => {}} />
    )
    const buttons = container.querySelectorAll("button")
    expect(buttons.length).toBeGreaterThan(0)
    for (const btn of buttons) {
      expect(btn.className).toContain("focus-ring")
    }
  })

  it("StatsSubTabs — active sub-tab button carries .focus-ring", () => {
    const { container } = render(<StatsSubTabs />)
    const active = container.querySelector('button[aria-selected="true"]')
    expectFocusRing(active, "StatsSubTabs active tab")
  })

  it("StatsClassFilter — chip buttons carry .focus-ring", () => {
    const { container } = render(<StatsClassFilter />)
    const chip = container.querySelector('button[role="switch"]')
    expectFocusRing(chip, "StatsClassFilter chip")
  })

  it("LeadingTable (desktop) — a sort header button carries .focus-ring", () => {
    const { container } = render(<LeadingTable />)
    const sortBtn = container.querySelector(
      'button[data-testid="leading-sort-class"]'
    )
    expectFocusRing(sortBtn, "LeadingTable sort header")
    const nrBtn = container.querySelector('button[data-testid="leading-row-nr"]')
    expectFocusRing(nrBtn, "LeadingTable #NR row button")
  })

  it("LeadingTable (mobile) — card button carries .focus-ring", () => {
    mockBreakpoint = "mobile"
    const { container } = render(<LeadingTable />)
    const card = container.querySelector('button[data-testid="leading-row"]')
    expectFocusRing(card, "LeadingTable mobile card")
  })

  it("SectorHeatmap — class-jump button carries .focus-ring", () => {
    const { container } = render(<SectorHeatmap />)
    const jump = container.querySelector(
      'button[data-testid="heatmap-class-jump"]'
    )
    expectFocusRing(jump, "SectorHeatmap class-jump")
  })

  it("BestLapPerClassChart (mobile) — Mehr-anzeigen button carries .focus-ring", () => {
    mockBreakpoint = "mobile"
    useLiveStore.setState({
      ...initialLive,
      sessionMeta: null,
      statistics: {
        PID: "9002",
        BESTLAPS: Array.from({ length: 7 }, (_, i) => ({
          CLASS: `C${i}`,
          NR: String(100 + i),
          LAPTIME: `8:${String(10 + i).padStart(2, "0")}.000`,
        })),
      } as unknown as Pid9002Frame,
    })
    const { container } = render(<BestLapPerClassChart />)
    const expand = container.querySelector(
      'button[data-testid="best-lap-expand"]'
    )
    expectFocusRing(expand, "BestLapPerClassChart expand")
  })
})
