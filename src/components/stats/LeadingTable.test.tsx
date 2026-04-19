import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Pid0Frame, Pid9002Frame } from "@/domain"
import type { Breakpoint } from "@/hooks/useBreakpoint"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"
import { useUiStore } from "@/store/useUiStore"

let mockBreakpoint: Breakpoint = "desktop"
vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpoint: () => mockBreakpoint,
}))

import { LeadingTable } from "./LeadingTable"

const THREE_LEADING_ROWS = [
  { CLASS: "SP9", NR: "911", LAPS: "124", GAP: "", SUM: "16:41:22.401", FROMLAP: 142 },
  { CLASS: "SP-X", NR: "706", LAPS: "122", GAP: "+2 Laps", SUM: "16:42:01.884", FROMLAP: 138 },
  { CLASS: "CUP2", NR: "121", LAPS: "118", GAP: "+6 Laps", SUM: "16:41:55.332", FROMLAP: 130 },
]

function setStats(rows: Array<Record<string, unknown>>): void {
  useLiveStore.setState({
    statistics: {
      PID: "9002",
      LEADING: rows,
    } as unknown as Pid9002Frame,
  })
}

function setSnapshot(rows: Array<Record<string, unknown>>): void {
  useLiveStore.setState({
    sessionMeta: {
      PID: "0",
      RESULT: rows,
    } as unknown as Pid0Frame,
  })
}

describe("LeadingTable", () => {
  const initialLive = useLiveStore.getState()
  const initialFilters = useFilterStore.getState()
  const initialUi = useUiStore.getState()

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
    useUiStore.setState({
      ...initialUi,
      selectedStartingNo: null,
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
    useUiStore.setState({
      ...initialUi,
      selectedStartingNo: null,
    })
  })

  it("renders the empty message and no <table> / <ul> when statistics is null", () => {
    const { container } = render(<LeadingTable />)
    expect(screen.getByText("Keine Führenden verfügbar")).toBeTruthy()
    expect(container.querySelector("table")).toBeNull()
    expect(container.querySelector("ul")).toBeNull()
  })

  it("desktop: renders the seven column headers in spec order", () => {
    setStats(THREE_LEADING_ROWS)
    const { container } = render(<LeadingTable />)

    const headers = Array.from(
      container.querySelectorAll<HTMLTableCellElement>("thead th")
    ).map((th) => {
      const button = th.querySelector("button")
      if (button) {
        return (button.firstChild?.textContent ?? "").trim()
      }
      return (th.textContent ?? "").trim()
    })
    expect(headers).toEqual([
      "Klasse",
      "#",
      "Fahrer / Team",
      "Runden",
      "Gap",
      "Zeit gesamt",
      "seit Runde",
    ])
  })

  it("desktop: renders one <tr> per row with data-class + data-nr and data-variant=desktop", () => {
    setStats(THREE_LEADING_ROWS)
    const { container } = render(<LeadingTable />)

    const root = container.querySelector('[data-testid="leading-table"]')!
    expect(root.getAttribute("data-variant")).toBe("desktop")

    const rows = container.querySelectorAll<HTMLTableRowElement>(
      'tbody tr[data-testid="leading-row"]'
    )
    expect(rows).toHaveLength(3)
    expect(rows[0]!.getAttribute("data-class")).toBe("SP9")
    expect(rows[0]!.getAttribute("data-nr")).toBe("911")
    expect(rows[2]!.getAttribute("data-class")).toBe("CUP2")
    expect(rows[2]!.getAttribute("data-nr")).toBe("121")
  })

  it("desktop: zebra alternates surface-container-lowest/40 (even) and surface-container-low (odd)", () => {
    setStats(THREE_LEADING_ROWS)
    const { container } = render(<LeadingTable />)

    const rows = container.querySelectorAll<HTMLTableRowElement>(
      'tbody tr[data-testid="leading-row"]'
    )
    expect(rows[0]!.className).toContain("bg-surface-container-lowest/40")
    expect(rows[1]!.className).toContain("bg-surface-container-low")
    expect(rows[2]!.className).toContain("bg-surface-container-lowest/40")
  })

  it("desktop: leader gap cell renders 'Leader' with text-secondary-container", () => {
    setStats(THREE_LEADING_ROWS)
    const { container } = render(<LeadingTable />)

    const firstRow = container.querySelectorAll("tbody tr")[0]!
    const gapCell = firstRow.querySelectorAll("td")[4]!
    expect(gapCell.textContent).toBe("Leader")
    expect(gapCell.className).toContain("text-secondary-container")
  })

  it("desktop: non-leader gap cell renders the raw gap with text-zinc-500", () => {
    setStats(THREE_LEADING_ROWS)
    const { container } = render(<LeadingTable />)

    const secondRow = container.querySelectorAll("tbody tr")[1]!
    const gapCell = secondRow.querySelectorAll("td")[4]!
    expect(gapCell.textContent).toBe("+2 Laps")
    expect(gapCell.className).toContain("text-zinc-500")
  })

  it("desktop: clicking the #NR button calls setSelectedStartingNo with the row's NR", () => {
    setStats(THREE_LEADING_ROWS)
    const { container } = render(<LeadingTable />)

    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '[data-testid="leading-row-nr"]'
    )
    expect(buttons).toHaveLength(3)
    expect(buttons[1]!.textContent).toBe("#706")
    fireEvent.click(buttons[1]!)
    expect(useUiStore.getState().selectedStartingNo).toBe("706")
  })

  it("desktop: NR button is disabled when carNumber is em-dash and click is a no-op", () => {
    setStats([
      { CLASS: "SP9", NR: "  ", LAPS: "124", GAP: "", SUM: "16:41:22.401" },
    ])
    const { container } = render(<LeadingTable />)

    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="leading-row-nr"]'
    )!
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(useUiStore.getState().selectedStartingNo).toBeNull()
  })

  it("desktop: driver/team column shows the joined RESULT.STNR result, em-dash otherwise", () => {
    setStats(THREE_LEADING_ROWS)
    setSnapshot([
      { STNR: "911", NAME: "Vanthorr / Estre / Preining", TEAM: "Manthey EMA" },
    ])
    const { container } = render(<LeadingTable />)

    const rows = container.querySelectorAll("tbody tr")
    const sp9DriverTeam = rows[0]!.querySelectorAll("td")[2]!
    const spxDriverTeam = rows[1]!.querySelectorAll("td")[2]!
    expect(sp9DriverTeam.textContent).toBe(
      "Vanthorr / Estre / Preining · Manthey EMA"
    )
    expect(spxDriverTeam.textContent).toBe("—")
  })

  it("desktop: TOTAL row is filtered out automatically; excluded class is filtered too", () => {
    setStats([
      { CLASS: "TOTAL", NR: "0", LAPS: "200" },
      ...THREE_LEADING_ROWS,
    ])
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(["CUP2"]),
    })
    const { container } = render(<LeadingTable />)

    const rows = container.querySelectorAll("tbody tr")
    expect(rows).toHaveLength(2)
    const classes = Array.from(rows).map((r) =>
      r.getAttribute("data-class")
    )
    expect(classes).toEqual(["SP9", "SP-X"])
  })

  it("mobile: renders <ul> of buttons with border-l-2 border-primary-container and a chevron_right icon", () => {
    mockBreakpoint = "mobile"
    setStats(THREE_LEADING_ROWS)
    const { container } = render(<LeadingTable />)

    const root = container.querySelector('[data-testid="leading-table"]')!
    expect(root.getAttribute("data-variant")).toBe("mobile")

    const ul = container.querySelector("ul")
    expect(ul).not.toBeNull()
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      'li > button[data-testid="leading-row"]'
    )
    expect(buttons).toHaveLength(3)
    expect(buttons[0]!.className).toContain("border-l-2")
    expect(buttons[0]!.className).toContain("border-primary-container")

    const chevrons = container.querySelectorAll(
      'span[data-icon="chevron_right"]'
    )
    expect(chevrons).toHaveLength(3)
  })

  it("mobile: clicking a card opens the drilldown via setSelectedStartingNo", () => {
    mockBreakpoint = "mobile"
    setStats(THREE_LEADING_ROWS)
    const { container } = render(<LeadingTable />)

    const buttons = container.querySelectorAll<HTMLButtonElement>(
      'li > button[data-testid="leading-row"]'
    )
    fireEvent.click(buttons[2]!)
    expect(useUiStore.getState().selectedStartingNo).toBe("121")
  })

  it("mobile: filters out excluded classes and the TOTAL row", () => {
    mockBreakpoint = "mobile"
    setStats([
      { CLASS: "TOTAL", NR: "0", LAPS: "200" },
      ...THREE_LEADING_ROWS,
    ])
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(["SP-X"]),
    })
    const { container } = render(<LeadingTable />)

    const buttons = container.querySelectorAll<HTMLButtonElement>(
      'li > button[data-testid="leading-row"]'
    )
    expect(buttons).toHaveLength(2)
    const classes = Array.from(buttons).map((b) =>
      b.getAttribute("data-class")
    )
    expect(classes).toEqual(["SP9", "CUP2"])
  })

  describe("desktop sortable headers", () => {
    function classOrder(container: HTMLElement): string[] {
      return Array.from(
        container.querySelectorAll<HTMLTableRowElement>(
          'tbody tr[data-testid="leading-row"]'
        )
      ).map((r) => r.getAttribute("data-class") ?? "")
    }

    function ariaSort(container: HTMLElement, testId: string): string | null {
      const btn = container.querySelector<HTMLButtonElement>(
        `[data-testid="${testId}"]`
      )
      return btn?.closest("th")?.getAttribute("aria-sort") ?? null
    }

    it("initial render: every sortable header has aria-sort=none", () => {
      setStats(THREE_LEADING_ROWS)
      const { container } = render(<LeadingTable />)
      expect(ariaSort(container, "leading-sort-class")).toBe("none")
      expect(ariaSort(container, "leading-sort-laps")).toBe("none")
      expect(ariaSort(container, "leading-sort-gap")).toBe("none")
      expect(ariaSort(container, "leading-sort-sum")).toBe("none")
    })

    it("Klasse: 1 click → ascending A→Z", () => {
      setStats(THREE_LEADING_ROWS)
      const { container } = render(<LeadingTable />)
      const btn = container.querySelector<HTMLButtonElement>(
        '[data-testid="leading-sort-class"]'
      )!
      fireEvent.click(btn)
      expect(ariaSort(container, "leading-sort-class")).toBe("ascending")
      // Note: localeCompare(numeric:true, sensitivity:base) puts '-' before
      // digits, so SP-X precedes SP9 — that matches the spec's "sensible"
      // intent (numeric tokens) without contradicting Stitch ordering.
      expect(classOrder(container)).toEqual(["CUP2", "SP-X", "SP9"])
    })

    it("Klasse: 2 clicks → descending Z→A", () => {
      setStats(THREE_LEADING_ROWS)
      const { container } = render(<LeadingTable />)
      const btn = container.querySelector<HTMLButtonElement>(
        '[data-testid="leading-sort-class"]'
      )!
      fireEvent.click(btn)
      fireEvent.click(btn)
      expect(ariaSort(container, "leading-sort-class")).toBe("descending")
      expect(classOrder(container)).toEqual(["SP9", "SP-X", "CUP2"])
    })

    it("Klasse: 3 clicks → unsorted, wire order restored", () => {
      setStats(THREE_LEADING_ROWS)
      const { container } = render(<LeadingTable />)
      const btn = container.querySelector<HTMLButtonElement>(
        '[data-testid="leading-sort-class"]'
      )!
      fireEvent.click(btn)
      fireEvent.click(btn)
      fireEvent.click(btn)
      expect(ariaSort(container, "leading-sort-class")).toBe("none")
      expect(classOrder(container)).toEqual(["SP9", "SP-X", "CUP2"])
    })

    it("Runden: ascending sorts by laps; null laps go LAST", () => {
      setStats([
        { CLASS: "SP9", NR: "911", LAPS: "124", GAP: "", SUM: "16:41:22.401" },
        { CLASS: "SP-X", NR: "706", LAPS: "", GAP: "+2 Laps", SUM: "16:42:01.884" },
        { CLASS: "CUP2", NR: "121", LAPS: "118", GAP: "+6 Laps", SUM: "16:41:55.332" },
      ])
      const { container } = render(<LeadingTable />)
      const btn = container.querySelector<HTMLButtonElement>(
        '[data-testid="leading-sort-laps"]'
      )!
      fireEvent.click(btn)
      expect(ariaSort(container, "leading-sort-laps")).toBe("ascending")
      expect(classOrder(container)).toEqual(["CUP2", "SP9", "SP-X"])
    })

    it("Runden then Gap: only one sort active at a time", () => {
      setStats(THREE_LEADING_ROWS)
      const { container } = render(<LeadingTable />)
      fireEvent.click(
        container.querySelector<HTMLButtonElement>(
          '[data-testid="leading-sort-laps"]'
        )!
      )
      expect(ariaSort(container, "leading-sort-laps")).toBe("ascending")
      fireEvent.click(
        container.querySelector<HTMLButtonElement>(
          '[data-testid="leading-sort-gap"]'
        )!
      )
      expect(ariaSort(container, "leading-sort-laps")).toBe("none")
      expect(ariaSort(container, "leading-sort-gap")).toBe("ascending")
    })

    it("Gap: leader rows always sort to the TOP for asc and desc", () => {
      setStats(THREE_LEADING_ROWS)
      const { container } = render(<LeadingTable />)
      const gapBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="leading-sort-gap"]'
      )!
      fireEvent.click(gapBtn)
      expect(classOrder(container)[0]).toBe("SP9")
      fireEvent.click(gapBtn)
      expect(ariaSort(container, "leading-sort-gap")).toBe("descending")
      expect(classOrder(container)[0]).toBe("SP9")
    })

    it("mobile: sortable header buttons are not rendered", () => {
      mockBreakpoint = "mobile"
      setStats(THREE_LEADING_ROWS)
      const { container } = render(<LeadingTable />)
      expect(
        container.querySelectorAll('[data-testid="leading-sort-class"]')
      ).toHaveLength(0)
      expect(
        container.querySelectorAll('[data-testid="leading-sort-laps"]')
      ).toHaveLength(0)
      expect(
        container.querySelectorAll('[data-testid="leading-sort-gap"]')
      ).toHaveLength(0)
      expect(
        container.querySelectorAll('[data-testid="leading-sort-sum"]')
      ).toHaveLength(0)
      expect(container.querySelector("thead")).toBeNull()
    })
  })
})
