import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Pid9002Frame } from "@/domain"
import type { Breakpoint } from "@/hooks/useBreakpoint"
import { useFilterStore } from "@/store/useFilterStore"
import { useLiveStore } from "@/store/useLiveStore"

let mockBreakpoint: Breakpoint = "desktop"
vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpoint: () => mockBreakpoint,
}))

import { SectorHeatmap } from "./SectorHeatmap"

// All sector values < 60 s so `formatLapSeconds` keeps them as `"NN.NNN"`
// (it switches to `m:ss.SSS` at >= 60 s). SP9 owns every column-best on S1..S3,
// SP-X owns S4. CUP2's S1 sits at +19 % so it lands on the slowest stop (10).
const FOUR_SECTOR_ROWS = [
  { CLASS: "SP9", S1: "21.0", S2: "34.0", S3: "40.0", S4: "16.0", LAPTIME: "1:51.000" },
  { CLASS: "SP-X", S1: "21.1", S2: "34.5", S3: "41.0", S4: "15.5", LAPTIME: "1:52.100" },
  { CLASS: "CUP2", S1: "25.0", S2: "39.0", S3: "51.0", S4: "21.0", LAPTIME: "2:16.000" },
]

describe("SectorHeatmap", () => {
  const initialLive = useLiveStore.getState()
  const initialFilters = useFilterStore.getState()

  function setRows(rows: Array<Record<string, unknown>>) {
    useLiveStore.setState({
      ...initialLive,
      statistics: {
        PID: "9002",
        BESTSECTORS: rows,
      } as unknown as Pid9002Frame,
    })
  }

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

  it("renders the empty message and no <table> when statistics is null", () => {
    const { container } = render(<SectorHeatmap />)
    expect(screen.getByText("Keine Sektor-Daten verfügbar")).toBeTruthy()
    expect(container.querySelector("table")).toBeNull()
  })

  it("renders desktop variant with KLS S1..S4 LAP header and one row per class", () => {
    setRows(FOUR_SECTOR_ROWS)
    const { container } = render(<SectorHeatmap />)

    const root = container.querySelector('[data-testid="sector-heatmap"]')!
    expect(root.getAttribute("data-variant")).toBe("desktop")

    const table = container.querySelector("table")!
    expect(table.className).toContain("border-separate")
    expect(table.className).toContain("border-spacing-px")

    const ths = Array.from(
      container.querySelectorAll<HTMLTableCellElement>("thead th")
    ).map((el) => el.textContent)
    expect(ths).toEqual(["KLS", "S1", "S2", "S3", "S4", "LAP"])

    const bodyRows = container.querySelectorAll("tbody tr")
    expect(bodyRows).toHaveLength(3)
  })

  it("renders the column-best cell with bg-red-600 (no opacity) AND text-white font-bold", () => {
    setRows(FOUR_SECTOR_ROWS)
    const { container } = render(<SectorHeatmap />)

    const firstRowCells = container.querySelectorAll("tbody tr")[0]!.querySelectorAll("td")
    const s1 = firstRowCells[0]!
    expect(s1.className).toContain("bg-red-600")
    expect(s1.className).not.toContain("bg-red-600/")
    expect(s1.className).toContain("text-white")
    expect(s1.className).toContain("font-bold")
  })

  it("renders the slowest cell in a column with bg-red-600/10", () => {
    setRows(FOUR_SECTOR_ROWS)
    const { container } = render(<SectorHeatmap />)

    const cup2Cells = container
      .querySelectorAll("tbody tr")[2]!
      .querySelectorAll("td")
    const cup2S1 = cup2Cells[0]!
    expect(cup2S1.className).toContain("bg-red-600/10")
  })

  it("renders an empty <td> with bg-zinc-900/40 text-zinc-700 when a row's S{n} is missing", () => {
    setRows([
      { CLASS: "SP9", S1: "81.0", S2: "94.0", S3: "120.0", S4: "76.0", S5: "30.0" },
      { CLASS: "TOTAL", S1: "80.0", S2: "92.0", S3: "118.0", S4: "75.0" /* S5 missing */ },
    ])
    const { container } = render(<SectorHeatmap />)

    const totalRow = container
      .querySelector('[data-testid="sector-heatmap"]')!
      .querySelectorAll("tbody tr")[0]!
    const totalCells = totalRow.querySelectorAll("td")
    const s5 = totalCells[4]!
    expect(s5.textContent).toBe("")
    expect(s5.className).toContain("bg-zinc-900/40")
    expect(s5.className).toContain("text-zinc-700")
  })

  it("renders the LAP column with bg-zinc-800 (desktop)", () => {
    setRows(FOUR_SECTOR_ROWS)
    const { container } = render(<SectorHeatmap />)

    const firstRowCells = container.querySelectorAll("tbody tr")[0]!.querySelectorAll("td")
    const lap = firstRowCells[firstRowCells.length - 1]!
    expect(lap.className).toContain("bg-zinc-800")
    expect(lap.textContent).toBe("1:51.000")
  })

  it("aria-label exposes Bestzeit for the column-best and Δ +X.XXX s (+Y.YY %) otherwise", () => {
    setRows(FOUR_SECTOR_ROWS)
    const { container } = render(<SectorHeatmap />)

    const cells = container.querySelectorAll("tbody tr")
    const sp9S1 = cells[0]!.querySelectorAll("td")[0]!
    expect(sp9S1.getAttribute("aria-label")).toContain("Bestzeit")
    expect(sp9S1.getAttribute("title")).toContain("Bestzeit")

    const cup2S1 = cells[2]!.querySelectorAll("td")[0]!
    const aria = cup2S1.getAttribute("aria-label")!
    expect(aria).toMatch(/Δ \+\d+\.\d{3} s \(\+\d+\.\d{2} %\)/)
  })

  it("renders the mobile variant with sticky first column on header AND body rows, plus a secondary pill on the column-best cell", () => {
    mockBreakpoint = "mobile"
    setRows(FOUR_SECTOR_ROWS)
    const { container } = render(<SectorHeatmap />)

    const root = container.querySelector('[data-testid="sector-heatmap"]')!
    expect(root.getAttribute("data-variant")).toBe("mobile")

    const table = container.querySelector("table")!
    expect(table.className).toContain("border-collapse")

    const ths = Array.from(
      container.querySelectorAll<HTMLTableCellElement>("thead th")
    ).map((el) => el.textContent)
    expect(ths).toEqual(["Klasse", "S1", "S2", "S3", "S4", "LAP"])

    const headClass = container.querySelector<HTMLTableCellElement>(
      'thead th[scope="col"]'
    )!
    expect(headClass.className).toContain("sticky")
    expect(headClass.className).toContain("left-0")
    expect(headClass.className).toContain("bg-background")

    const rowHead = container.querySelector<HTMLTableCellElement>(
      'tbody th[scope="row"]'
    )!
    expect(rowHead.className).toContain("sticky")
    expect(rowHead.className).toContain("left-0")
    expect(rowHead.className).toContain("bg-background")

    // SP9 owns S1 column-best (81.0) → pill with secondary container.
    const sp9Row = container.querySelectorAll("tbody tr")[0]!
    const sp9S1Span = sp9Row.querySelectorAll("td")[0]!.querySelector("span")!
    expect(sp9S1Span.className).toContain("bg-secondary-container/20")
    expect(sp9S1Span.className).toContain("text-secondary")
    expect(sp9S1Span.textContent).toBe("21.000")
  })

  it("mobile slowest tier (CUP2 S1) renders plain text without a <span> pill", () => {
    mockBreakpoint = "mobile"
    setRows(FOUR_SECTOR_ROWS)
    const { container } = render(<SectorHeatmap />)

    const cup2Row = container.querySelectorAll("tbody tr")[2]!
    const cup2S1 = cup2Row.querySelectorAll("td")[0]!
    expect(cup2S1.querySelector("span")).toBeNull()
    expect(cup2S1.textContent).toBe("25.000")
  })

  it("hides excluded classes from BOTH variants and from the column-best computation", () => {
    setRows(FOUR_SECTOR_ROWS)
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(["SP9"]),
    })
    const { container } = render(<SectorHeatmap />)

    const bodyRows = container.querySelectorAll("tbody tr")
    expect(bodyRows).toHaveLength(2)
    expect(screen.queryByText("SP9")).toBeNull()

    // Without SP9, SP-X owns S1 (82.0) → its first cell is the column best.
    const spxRow = bodyRows[0]!
    const spxS1 = spxRow.querySelectorAll("td")[0]!
    expect(spxS1.className).toContain("bg-red-600")
    expect(spxS1.className).not.toContain("bg-red-600/")
  })

  it("desktop: clicking the SP9 class-label button calls scrollIntoView on the matching leading-table row", () => {
    const scrollSpy = vi.fn()
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView =
      scrollSpy as unknown as typeof Element.prototype.scrollIntoView
    try {
      setRows(FOUR_SECTOR_ROWS)
      document.body.insertAdjacentHTML(
        "beforeend",
        `<table><tbody><tr data-testid="leading-row" data-class="SP9" data-nr="42"></tr></tbody></table>`
      )
      const { container } = render(<SectorHeatmap />)

      const jumpBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="heatmap-class-jump"][data-class="SP9"]'
      )!
      expect(jumpBtn.tagName).toBe("BUTTON")
      fireEvent.click(jumpBtn)
      expect(scrollSpy).toHaveBeenCalledTimes(1)
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView
      document.body.innerHTML = ""
    }
  })

  it("mobile: clicking the SP9 class-label button calls scrollIntoView on the matching leading-table row", () => {
    const scrollSpy = vi.fn()
    const originalScrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView =
      scrollSpy as unknown as typeof Element.prototype.scrollIntoView
    try {
      mockBreakpoint = "mobile"
      setRows(FOUR_SECTOR_ROWS)
      document.body.insertAdjacentHTML(
        "beforeend",
        `<table><tbody><tr data-testid="leading-row" data-class="SP9" data-nr="42"></tr></tbody></table>`
      )
      const { container } = render(<SectorHeatmap />)

      const jumpBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="heatmap-class-jump"][data-class="SP9"]'
      )!
      expect(jumpBtn.tagName).toBe("BUTTON")
      fireEvent.click(jumpBtn)
      expect(scrollSpy).toHaveBeenCalledTimes(1)
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView
      document.body.innerHTML = ""
    }
  })

  it("never filters TOTAL — even when 'TOTAL' is in excludedStatsClasses — and renders it first", () => {
    setRows([
      ...FOUR_SECTOR_ROWS,
      {
        CLASS: "TOTAL",
        S1: "80.0",
        S2: "92.0",
        S3: "118.0",
        S4: "74.0",
        LAPTIME: "6:04.000",
      },
    ])
    useFilterStore.setState({
      ...initialFilters,
      excludedStatsClasses: new Set(["TOTAL"]),
    })

    const { container } = render(<SectorHeatmap />)

    const rowHeads = Array.from(
      container.querySelectorAll<HTMLTableCellElement>('tbody th[scope="row"]')
    ).map((el) => el.textContent)
    expect(rowHeads[0]).toBe("TOTAL")
    expect(rowHeads).toEqual(["TOTAL", "SP9", "SP-X", "CUP2"])
  })
})
