import { describe, expect, it } from "vitest"

import { translate } from "./strings"

describe("translate", () => {
  it("falls back to German when key missing in English", () => {
    expect(translate("en", "col.pos")).toBe("Pos")
  })

  it("returns key when missing from all tables", () => {
    expect(translate("de", "totally.unknown.key.xyz")).toBe("totally.unknown.key.xyz")
  })

  it("uses English string when present", () => {
    expect(translate("en", "col.gap")).toBe("Gap")
  })
})
