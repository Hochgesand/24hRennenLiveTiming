import { describe, expect, it } from "vitest"

import { computeRemoteTimeDiff } from "./timeSync"

describe("computeRemoteTimeDiff", () => {
  it("computes offset for realistic epoch-ms timestamps (RTT + clock skew)", () => {
    const now = 1_704_000_000_123
    const clientLocalTime = 1_704_000_000_100
    const serverLocalTime = 1_703_999_999_900
    // rttHalf = floor((123 - 100) / 2) = 11; now - serverLocalTime = 223
    expect(computeRemoteTimeDiff(now, clientLocalTime, serverLocalTime)).toBe(234)
  })

  it("uses zero RTT half when clientLocalTime equals now", () => {
    const now = 5_000
    expect(computeRemoteTimeDiff(now, now, 4_000)).toBe(now - 4_000)
  })

  it("floors one-way delay from RTT (odd millisecond remainder)", () => {
    const now = 101
    const clientLocalTime = 100
    const serverLocalTime = 50
    expect(Math.floor((now - clientLocalTime) / 2)).toBe(0)
    expect(computeRemoteTimeDiff(now, clientLocalTime, serverLocalTime)).toBe(51)
  })

  it("applies full RTT half when delay is even", () => {
    const now = 1_000
    const clientLocalTime = 900
    const serverLocalTime = 500
    expect(computeRemoteTimeDiff(now, clientLocalTime, serverLocalTime)).toBe(550)
  })
})
