/**
 * Offset (ms) to add to `Date.now()` so the UI clock aligns with the live-timing
 * server clock, using the same RTT-adjusted formula as `useLiveConnection` on
 * LTS_TIMESYNC (`onTimesync`).
 */
export function computeRemoteTimeDiff(
  now: number,
  clientLocalTime: number,
  serverLocalTime: number,
): number {
  const rttHalf = Math.floor((now - clientLocalTime) / 2)
  return now - serverLocalTime + rttHalf
}
