import { describe, expect, it } from "vitest"

import { decodeLapStatus, decodeResultRow } from "./decode"
import type { RawResultRow } from "./types"

/** Minimal realistic `RESULT` row from PID 0 (wire keys). */
const fixtureRawResultRow: RawResultRow = {
  POSITION: 1,
  STNR: "7",
  NAME: "M. Verstappen",
  TEAM: "Red Bull Racing",
  CAR: "RB20",
  GAP: "—",
  CHG: 0,
  CLASSNAME: "F1",
  PRO: "PRO",
  LASTLAPTIME: "1:26.945",
  LLTS: "P",
  FASTESTLAP: "1:26.012",
  FLTS: "O",
  S1TIME: "28.123",
  ST1T: "S",
  S2TIME: "32.456",
  ST2T: "I",
  S3TIME: "26.366",
  ST3T: "2",
}

describe("decodeLapStatus", () => {
  it("maps common wire codes", () => {
    expect(decodeLapStatus("P")).toBe("personalBest")
    expect(decodeLapStatus("O")).toBe("overallBest")
    expect(decodeLapStatus("S")).toBe("sessionBest")
    expect(decodeLapStatus("I")).toBe("inLap")
    expect(decodeLapStatus("2")).toBe("outLap")
    expect(decodeLapStatus("X")).toBe("invalid")
    expect(decodeLapStatus("")).toBe("normal")
  })
})

describe("decodeResultRow", () => {
  it("maps UPPERCASE keys to camelCase and decodes status fields", () => {
    const decoded = decodeResultRow(fixtureRawResultRow)

    expect(decoded.position).toBe(1)
    expect(decoded.stnr).toBe("7")
    expect(decoded.name).toBe("M. Verstappen")
    expect(decoded.team).toBe("Red Bull Racing")
    expect(decoded.car).toBe("RB20")
    expect(decoded.gap).toBe("—")
    expect(decoded.chg).toBe(0)
    expect(decoded.className).toBe("F1")
    expect(decoded.pro).toBe("PRO")
    expect(decoded.lastLapTime).toBe("1:26.945")
    expect(decoded.fastestLap).toBe("1:26.012")

    expect(decoded.llts).toBe("personalBest")
    expect(decoded.flts).toBe("overallBest")

    expect(decoded.s1Time).toBe("28.123")
    expect(decoded.st1t).toBe("sessionBest")
    expect(decoded.s2Time).toBe("32.456")
    expect(decoded.st2t).toBe("inLap")
    expect(decoded.s3Time).toBe("26.366")
    expect(decoded.st3t).toBe("outLap")
  })
})
