import { describe, expect, it } from "vitest"

import type { Pid4Frame } from "@/domain"

import {
  connectionUi,
  endTimeDisplay,
  formatMmSs,
  isTimeStateCountdown,
  trackStateLabel,
} from "./sessionInfo"

const t = (key: string): string => key

describe("connectionUi", () => {
  it("returns the reconnecting set when reconnecting=true regardless of status", () => {
    const ui = connectionUi("connected", true, t)
    expect(ui.label).toBe("conn.reconnecting")
    expect(ui.dotClass).toContain("bg-amber-400")
    expect(ui.dotClass).toContain("animate-pulse")
  })

  it("returns the connecting set for status=connecting", () => {
    const ui = connectionUi("connecting", false, t)
    expect(ui.label).toBe("conn.connecting")
    expect(ui.dotClass).toContain("bg-amber-400")
  })

  it("returns the connecting set for status=idle", () => {
    const ui = connectionUi("idle", false, t)
    expect(ui.label).toBe("conn.connecting")
  })

  it("returns the connected set for status=connected", () => {
    const ui = connectionUi("connected", false, t)
    expect(ui.label).toBe("conn.connected")
    expect(ui.dotClass).toContain("var(--stitch-secondary)")
  })

  it("returns the error set for status=error", () => {
    const ui = connectionUi("error", false, t)
    expect(ui.label).toBe("conn.error")
    expect(ui.dotClass).toContain("bg-red-500")
  })

  it("returns the closed set for status=closed", () => {
    const ui = connectionUi("closed", false, t)
    expect(ui.label).toBe("conn.closed")
    expect(ui.dotClass).toContain("bg-muted-foreground/60")
  })
})

describe("formatMmSs", () => {
  it("formats whole minutes", () => {
    expect(formatMmSs(60_000)).toBe("1:00")
  })

  it("zero-pads seconds", () => {
    expect(formatMmSs(65_000)).toBe("1:05")
  })

  it("clamps negatives to 0:00", () => {
    expect(formatMmSs(-5_000)).toBe("0:00")
  })

  it("floors to seconds", () => {
    expect(formatMmSs(1_999)).toBe("0:01")
  })
})

describe("trackStateLabel", () => {
  it("returns green for '0'", () => {
    const r = trackStateLabel("0", t)
    expect(r.label).toBe("track.green")
    expect(r.className).toContain("emerald")
  })

  it("returns yellow for '1'", () => {
    expect(trackStateLabel("1", t).label).toBe("track.yellow")
  })

  it("returns red for '2'", () => {
    expect(trackStateLabel("2", t).label).toBe("track.red")
  })

  it("returns SC for '3'", () => {
    expect(trackStateLabel("3", t).label).toBe("track.sc")
  })

  it("renders an em-dash for empty/undefined input", () => {
    expect(trackStateLabel(undefined, t).label).toBe("—")
    expect(trackStateLabel("", t).label).toBe("—")
  })

  it("falls through to raw label for unknown numeric codes", () => {
    expect(trackStateLabel("9", t).label).toBe("9")
  })
})

describe("endTimeDisplay", () => {
  it("returns em-dash when track is null", () => {
    expect(endTimeDisplay(null, 0, 0)).toBe("—")
  })

  it("returns em-dash when ENDTIME is missing", () => {
    const track = { PID: "4" } as Pid4Frame
    expect(endTimeDisplay(track, 0, 0)).toBe("—")
  })

  it("returns em-dash for non-finite ENDTIME", () => {
    const track = { PID: "4", ENDTIME: "not-a-number" } as Pid4Frame
    expect(endTimeDisplay(track, 0, 0)).toBe("—")
  })

  it("formats a countdown when TIMESTATE='0'", () => {
    const track = {
      PID: "4",
      ENDTIME: 1_000_000_065_000,
      TIMESTATE: "0",
    } as unknown as Pid4Frame
    expect(endTimeDisplay(track, 0, 1_000_000_000_000)).toBe("1:05")
  })

  it("renders a wall-clock time when TIMESTATE != '0'", () => {
    const end = Date.UTC(2026, 3, 19, 12, 0, 0)
    const track = { PID: "4", ENDTIME: end, TIMESTATE: "1" } as unknown as Pid4Frame
    const out = endTimeDisplay(track, 0, 0)
    expect(out).toMatch(/\d{1,2}:\d{2}:\d{2}/)
  })
})

describe("isTimeStateCountdown", () => {
  it("returns false when track is null", () => {
    expect(isTimeStateCountdown(null)).toBe(false)
  })

  it("returns true when TIMESTATE is the string '0'", () => {
    expect(isTimeStateCountdown({ PID: "4", TIMESTATE: "0" } as Pid4Frame)).toBe(true)
  })

  it("returns false for any other TIMESTATE", () => {
    expect(isTimeStateCountdown({ PID: "4", TIMESTATE: "1" } as Pid4Frame)).toBe(false)
    expect(isTimeStateCountdown({ PID: "4" } as Pid4Frame)).toBe(false)
  })
})
