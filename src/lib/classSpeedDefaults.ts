/**
 * Cold-start class-average speeds used to bootstrap a car's marker velocity
 * before the first measured sector arrives. Values are rough metres-per-second
 * for a Nürburgring 24h field — they only matter for the brief window between
 * page load and the car's next intermediate crossing.
 */
const CLASS_DEFAULTS_MPS: Record<string, number> = {
  "SP9": 55,
  "SP-PRO": 55,
  "SPX": 55,
  "SP-X": 55,
  "SP10": 50,
  "SP8": 48,
  "SP7": 45,
  "SP6": 42,
  "SP5": 40,
  "SP4": 38,
  "SP3": 36,
  "V6": 50,
  "V5": 45,
  "V4": 42,
  "V3": 38,
  "V2T": 40,
  "AT": 40,
  "TCR": 50,
  "CUP3": 50,
  "CUP5": 48,
}

const TRACK_AVERAGE_MPS = 40

function normalize(className: string): string {
  return className.replace(/\s+/g, "").toUpperCase()
}

/** Static fallback speed when no running session mean is available yet. */
export function staticClassSpeedMps(className: string): number {
  const key = normalize(className)
  return CLASS_DEFAULTS_MPS[key] ?? TRACK_AVERAGE_MPS
}

export const FALLBACK_TRACK_AVERAGE_MPS = TRACK_AVERAGE_MPS
