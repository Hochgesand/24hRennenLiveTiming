import { describe, expect, it } from "vitest"

import { parseUrlConfig } from "./useUrlConfig"

describe("parseUrlConfig", () => {
  it("parses event and config from a typical query string", () => {
    expect(parseUrlConfig("?event=50&config=w3")).toEqual({
      eventId: "50",
      config: "w3",
      lang: "de",
      tab: "leaderboard",
    })
  })

  it("treats empty event as null", () => {
    expect(parseUrlConfig("?event=&config=w3")).toEqual({
      eventId: null,
      config: "w3",
      lang: "de",
      tab: "leaderboard",
    })
  })

  it("returns null eventId when event is absent", () => {
    expect(parseUrlConfig("?config=only")).toEqual({
      eventId: null,
      config: "only",
      lang: "de",
      tab: "leaderboard",
    })
  })

  it("uses the first value when event or config appears multiple times", () => {
    expect(parseUrlConfig("?event=1&event=2&config=a&config=b")).toEqual({
      eventId: "1",
      config: "a",
      lang: "de",
      tab: "leaderboard",
    })
  })

  it("accepts search without a leading question mark", () => {
    expect(parseUrlConfig("event=99&config=x")).toEqual({
      eventId: "99",
      config: "x",
      lang: "de",
      tab: "leaderboard",
    })
  })

  it("parses lang and tab when present", () => {
    expect(parseUrlConfig("?lang=en&tab=stats")).toEqual({
      eventId: null,
      config: null,
      lang: "en",
      tab: "stats",
    })
  })
})
