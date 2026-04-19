export function sectorColumnKey(n: number): string {
  return `s${n}`
}

/** Core leaderboard columns (wire-backed). */
export const LEADERBOARD_BASE_COLUMNS: readonly { key: string; labelKey: string }[] = [
  { key: "pos", labelKey: "col.pos" },
  { key: "num", labelKey: "col.num" },
  { key: "class", labelKey: "col.class" },
  { key: "driver", labelKey: "col.driver" },
  { key: "team", labelKey: "col.team" },
  { key: "car", labelKey: "col.car" },
  { key: "gap", labelKey: "col.gap" },
  { key: "last", labelKey: "col.last" },
  { key: "fast", labelKey: "col.fast" },
]

/** Optional columns (often hidden by default; wire keys vary). */
export const LEADERBOARD_OPTIONAL_COLUMNS: readonly { key: string; labelKey: string }[] = [
  { key: "pit", labelKey: "col.pit" },
  { key: "stint", labelKey: "col.stint" },
  { key: "tire", labelKey: "col.tire" },
  { key: "bestclass", labelKey: "col.bestclass" },
]

export const ALL_LEADERBOARD_COLUMN_DEFS: readonly { key: string; labelKey: string }[] = [
  ...LEADERBOARD_BASE_COLUMNS,
  ...LEADERBOARD_OPTIONAL_COLUMNS,
]

/** Static keys only (sectors are dynamic s1..s9). */
export const STATIC_LEADERBOARD_COLUMN_KEYS: readonly string[] =
  ALL_LEADERBOARD_COLUMN_DEFS.map((c) => c.key)

const MAX_SECTOR_URL = 9

export function allLeaderboardColumnKeysForUrl(): string[] {
  const sectors = Array.from({ length: MAX_SECTOR_URL }, (_, i) => sectorColumnKey(i + 1))
  return [...STATIC_LEADERBOARD_COLUMN_KEYS, ...sectors]
}

/**
 * Default hidden columns: team is stacked under driver; optional telemetry columns off.
 */
export function defaultExcludedLeaderboardColumns(): Set<string> {
  return new Set(["team", "car", "pit", "stint", "tire", "bestclass"])
}
