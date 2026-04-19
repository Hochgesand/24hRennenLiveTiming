import { describe, expect, it } from "vitest"

import { parseUrlConfig } from "./useUrlConfig"

describe("parseUrlConfig", () => {
  it("parses event and config from a typical query string", () => {
    expect(parseUrlConfig("?event=50&config=w3")).toEqual({
      eventId: "50",
      config: "w3",
    })
  })

  it("treats empty event as null", () => {
    expect(parseUrlConfig("?event=&config=w3")).toEqual({
      eventId: null,
      config: "w3",
    })
  })

  it("returns null eventId when event is absent", () => {
    expect(parseUrlConfig("?config=only")).toEqual({
      eventId: null,
      config: "only",
    })
  })

  it("uses the first value when event or config appears multiple times", () => {
    expect(parseUrlConfig("?event=1&event=2&config=a&config=b")).toEqual({
      eventId: "1",
      config: "a",
    })
  })

  it("accepts search without a leading question mark", () => {
    expect(parseUrlConfig("event=99&config=x")).toEqual({
      eventId: "99",
      config: "x",
    })
  })
})
