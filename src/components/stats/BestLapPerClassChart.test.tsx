import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Pid0Frame, Pid9002Frame } from "@/domain"
import type { Breakpoint } from "@/hooks/useBreakpoint"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"

let mockBreakpoint: Breakpoint = "desktop"
vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpoint: () => mockBreakpoint,
}))

import { BestLapPerClassChart } from "./BestLapPerClassChart"

describe("BestLapPerClassChart", () => {
  const initialLive = useLiveStore.getState()
  const initialFilters = useFilterStore.getState()

  beforeEach(() => {
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

  it("renders the empty message when statistics is null", () => {
    render(<BestLapPerClassChart />)
    expect(screen.getByText("Keine Bestzeiten verfügbar")).toBeTruthy()
  })

  it("renders one <li> per BESTLAPS row with the class label", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: {
        PID: "9002",
        BESTLAPS: [
          { CLASS: "SP9", NR: "100", LAPTIME: "8:01.500" },
          { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218" },
          { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
        ],
      } as unknown as Pid9002Frame,
    })

    const { container } = render(<BestLapPerClassChart />)
    const items = container.querySelectorAll("li")
    expect(items).toHaveLength(3)
    expect(screen.getByText("SP-Pro")).toBeTruthy()
    expect(screen.getByText("Cup3")).toBeTruthy()
    expect(screen.getByText("SP9")).toBeTruthy()
  })

  it("renders each row's formatted lap time inside a .font-mono cell", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: {
        PID: "9002",
        BESTLAPS: [
          { CLASS: "SP9", NR: "100", LAPTIME: "8:01.500" },
          { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218" },
          { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
        ],
      } as unknown as Pid9002Frame,
    })

    render(<BestLapPerClassChart />)
    for (const display of ["7:54.218", "7:59.001", "8:01.500"]) {
      const cell = screen.getByText(display)
      expect(cell.className).toContain("font-mono")
    }
  })

  it("renders the fastest row's bar with bg-red-600 (no opacity modifier) and width 100%", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: {
        PID: "9002",
        BESTLAPS: [
          { CLASS: "SP9", NR: "100", LAPTIME: "8:01.500" },
          { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218" },
          { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
        ],
      } as unknown as Pid9002Frame,
    })

    const { container } = render(<BestLapPerClassChart />)
    const fills = container.querySelectorAll<HTMLDivElement>(
      '[data-testid="best-lap-bar-fill"]'
    )
    expect(fills.length).toBe(3)
    const fastest = fills[0]!
    expect(fastest.className).toContain("bg-red-600")
    expect(fastest.className).not.toContain("bg-red-600/")
    expect(fastest.style.width).toBe("100%")
  })

  it("renders the third row's bar with bg-red-600/60", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: {
        PID: "9002",
        BESTLAPS: [
          { CLASS: "SP9", NR: "100", LAPTIME: "8:01.500" },
          { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218" },
          { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
        ],
      } as unknown as Pid9002Frame,
    })

    const { container } = render(<BestLapPerClassChart />)
    const fills = container.querySelectorAll<HTMLDivElement>(
      '[data-testid="best-lap-bar-fill"]'
    )
    expect(fills[2]!.className).toContain("bg-red-600/60")
  })

  it("renders an <li> with title containing class, #NR, lapTime, dayTime and driverTeam when all are present", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: {
        PID: "9002",
        BESTLAPS: [
          { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218", DAYTIME: "12:34:56" },
        ],
      } as unknown as Pid9002Frame,
      sessionMeta: {
        PID: "0",
        RESULT: [{ STNR: "911", NAME: "Max Mustermann", TEAM: "Manthey EMA" }],
      } as unknown as Pid0Frame,
    })

    const { container } = render(<BestLapPerClassChart />)
    const li = container.querySelector("li")!
    const title = li.getAttribute("title")!
    expect(title).toContain("SP-Pro")
    expect(title).toContain("#911")
    expect(title).toContain("7:54.218")
    expect(title).toContain("12:34:56")
    expect(title).toContain("Max Mustermann · Manthey EMA")
  })

  it("omits the trailing ` · driverTeam` fragment when no RESULT match exists", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: {
        PID: "9002",
        BESTLAPS: [
          { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218", DAYTIME: "12:34:56" },
        ],
      } as unknown as Pid9002Frame,
      sessionMeta: null,
    })

    const { container } = render(<BestLapPerClassChart />)
    const li = container.querySelector("li")!
    const title = li.getAttribute("title")!
    expect(title).toBe("SP-Pro · #911 · 7:54.218 · 12:34:56")
    expect(title.endsWith("12:34:56")).toBe(true)
  })

  it("renders identical `title` and `aria-label` on each row's <li>", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: {
        PID: "9002",
        BESTLAPS: [
          { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218", DAYTIME: "12:34:56" },
          { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
        ],
      } as unknown as Pid9002Frame,
      sessionMeta: {
        PID: "0",
        RESULT: [{ STNR: "911", NAME: "Max Mustermann", TEAM: "Manthey EMA" }],
      } as unknown as Pid0Frame,
    })

    const { container } = render(<BestLapPerClassChart />)
    const items = container.querySelectorAll("li")
    expect(items).toHaveLength(2)
    for (const li of items) {
      expect(li.getAttribute("title")).toBe(li.getAttribute("aria-label"))
      expect(li.getAttribute("title")).not.toBe("")
    }
  })

  describe("mobile expander", () => {
    const sixRows = [
      { CLASS: "ClsA", NR: "1", LAPTIME: "7:50.000" },
      { CLASS: "ClsB", NR: "2", LAPTIME: "7:55.000" },
      { CLASS: "ClsC", NR: "3", LAPTIME: "8:00.000" },
      { CLASS: "ClsD", NR: "4", LAPTIME: "8:05.000" },
      { CLASS: "ClsE", NR: "5", LAPTIME: "8:10.000" },
      { CLASS: "ClsF", NR: "6", LAPTIME: "8:15.000" },
    ]

    function setRows(rows: Array<{ CLASS: string; NR: string; LAPTIME: string }>) {
      useLiveStore.setState({
        ...initialLive,
        statistics: {
          PID: "9002",
          BESTLAPS: rows,
        } as unknown as Pid9002Frame,
      })
    }

    it("renders only the first 5 <li> when mobile and rows.length > 5", () => {
      mockBreakpoint = "mobile"
      setRows(sixRows)

      const { container } = render(<BestLapPerClassChart />)
      const items = container.querySelectorAll("li")
      expect(items).toHaveLength(5)
      expect(screen.queryByText("ClsF")).toBeNull()
    })

    it("uses the Top-5 heading on mobile when truncated", () => {
      mockBreakpoint = "mobile"
      setRows(sixRows)

      render(<BestLapPerClassChart />)
      expect(
        screen.getByText("Beste Runde pro Klasse — Top 5")
      ).toBeTruthy()
      expect(screen.queryByText("Beste Runde pro Klasse")).toBeNull()
    })

    it("expands to all rows and reverts heading when the button is clicked", () => {
      mockBreakpoint = "mobile"
      setRows(sixRows)

      const { container } = render(<BestLapPerClassChart />)
      const button = screen.getByTestId("best-lap-expand")
      fireEvent.click(button)

      const items = container.querySelectorAll("li")
      expect(items).toHaveLength(6)
      expect(screen.getByText("ClsF")).toBeTruthy()
      expect(screen.queryByTestId("best-lap-expand")).toBeNull()
      expect(screen.getByText("Beste Runde pro Klasse")).toBeTruthy()
      expect(
        screen.queryByText("Beste Runde pro Klasse — Top 5")
      ).toBeNull()
    })

    it("does not render the expand button on mobile when rows.length <= 5", () => {
      mockBreakpoint = "mobile"
      setRows(sixRows.slice(0, 5))

      render(<BestLapPerClassChart />)
      expect(screen.queryByTestId("best-lap-expand")).toBeNull()
      expect(screen.getByText("Beste Runde pro Klasse")).toBeTruthy()
    })

    it("renders the 5 fastest rows in fastest-first order on mobile", () => {
      mockBreakpoint = "mobile"
      setRows(sixRows)

      const { container } = render(<BestLapPerClassChart />)
      const monoCells = Array.from(
        container.querySelectorAll<HTMLSpanElement>("span.font-mono")
      ).map((el) => el.textContent)
      expect(monoCells).toEqual([
        "7:50.000",
        "7:55.000",
        "8:00.000",
        "8:05.000",
        "8:10.000",
      ])
    })

    it("renders all rows and no expand button on desktop with 8 rows", () => {
      mockBreakpoint = "desktop"
      const eightRows = [
        ...sixRows,
        { CLASS: "ClsG", NR: "7", LAPTIME: "8:20.000" },
        { CLASS: "ClsH", NR: "8", LAPTIME: "8:25.000" },
      ]
      setRows(eightRows)

      const { container } = render(<BestLapPerClassChart />)
      const items = container.querySelectorAll("li")
      expect(items).toHaveLength(8)
      expect(screen.queryByTestId("best-lap-expand")).toBeNull()
    })

    it("keeps the un-truncated heading on desktop even when there are >5 rows", () => {
      mockBreakpoint = "desktop"
      const eightRows = [
        ...sixRows,
        { CLASS: "ClsG", NR: "7", LAPTIME: "8:20.000" },
        { CLASS: "ClsH", NR: "8", LAPTIME: "8:25.000" },
      ]
      setRows(eightRows)

      render(<BestLapPerClassChart />)
      expect(screen.getByText("Beste Runde pro Klasse")).toBeTruthy()
      expect(
        screen.queryByText("Beste Runde pro Klasse — Top 5")
      ).toBeNull()
    })
  })

  it("hides excluded classes via useFilterStore.excludedStatsClasses", () => {
    useLiveStore.setState({
      ...initialLive,
      statistics: {
        PID: "9002",
        BESTLAPS: [
          { CLASS: "SP9", NR: "100", LAPTIME: "8:01.500" },
          { CLASS: "SP-Pro", NR: "911", LAPTIME: "7:54.218" },
          { CLASS: "Cup3", NR: "55", LAPTIME: "7:59.001" },
        ],
      } as unknown as Pid9002Frame,
    })
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(["SP9"]),
    })

    const { container } = render(<BestLapPerClassChart />)
    const items = container.querySelectorAll("li")
    expect(items).toHaveLength(2)
    expect(screen.queryByText("SP9")).toBeNull()
    expect(screen.getByText("SP-Pro")).toBeTruthy()
    expect(screen.getByText("Cup3")).toBeTruthy()
  })
})
