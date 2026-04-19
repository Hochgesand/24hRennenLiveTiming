import type { WireScalar } from "@/domain"

/** Parse wire `CHG` (position delta) to a finite number, or null if missing/invalid. */
export function parseChg(value: WireScalar | undefined): number | null {
  if (value === undefined || value === null || value === "") {
    return null
  }
  const n = typeof value === "number" ? value : Number(String(value).trim())
  return Number.isFinite(n) ? n : null
}
