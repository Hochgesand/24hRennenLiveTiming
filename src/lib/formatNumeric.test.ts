import { describe, expect, it } from "vitest"

import { formatDataNumeric } from "./formatNumeric"

describe("formatDataNumeric", () => {
  it.each([
    ["1:23.456", "lapTime", "1:23.456"],
    ["0.123", "lapTime", "0.123"],
    ["2:01.000", "lapTime", "2:01.000"],
    ["", "lapTime", "—"],
  ] as const)("lapTime %s -> %s", (input, kind, expected) => {
    expect(formatDataNumeric(input, kind).text).toBe(expected)
  })

  it.each([
    ["+12.3", "gap", "+12.3"],
    ["-5.0", "gap", "-5.0"],
    ["0", "gap", "—"],
    ["0.5", "gap", "+0.5"],
    ["—", "gap", "—"],
    ["1:30.0", "gap", "+90.0"],
  ] as const)("gap %s -> %s", (input, kind, expected) => {
    expect(formatDataNumeric(input, kind).text).toBe(expected)
  })

  it.each([
    [-1.2, "delta", "-1.2", "neg"],
    [0, "delta", "0.0", "zero"],
    [3.4, "delta", "+3.4", "pos"],
    ["-0.5", "delta", "-0.5", "neg"],
  ] as const)("delta value -> text and sign", (input, kind, expectedText, expectedSign) => {
    const r = formatDataNumeric(input, kind)
    expect(r.text).toBe(expectedText)
    expect(r.deltaSign).toBe(expectedSign)
  })
})
