/** Stable column ids for leaderboard visibility + `excCol=` URL (lowercase). */
export const LEADERBOARD_BASE_COLUMNS: readonly { key: string; label: string }[] = [
  { key: "pos", label: "Pos" },
  { key: "num", label: "#" },
  { key: "class", label: "Class" },
  { key: "driver", label: "Driver" },
  { key: "team", label: "Team" },
  { key: "car", label: "Car" },
  { key: "gap", label: "Gap" },
  { key: "last", label: "Last" },
  { key: "fast", label: "Fastest" },
]

export function sectorColumnKey(n: number): string {
  return `s${n}`
}
