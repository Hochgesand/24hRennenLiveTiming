import type { RawResultRow } from "@/domain"

function str(v: unknown): string {
  if (v === undefined || v === null) {
    return ""
  }
  return String(v).trim()
}

/** Drop rows whose CLASSNAME is in `excludedClasses` or PRO in `excludedProams`. */
export function filterLeaderboardRowsByExclusions(
  rows: RawResultRow[],
  excludedClasses: Set<string>,
  excludedProams: Set<string>
): RawResultRow[] {
  if (excludedClasses.size === 0 && excludedProams.size === 0) {
    return rows
  }
  return rows.filter((row) => {
    if (excludedClasses.has(str(row.CLASSNAME))) {
      return false
    }
    if (excludedProams.has(str(row.PRO))) {
      return false
    }
    return true
  })
}

function parsePosition(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null
  }
  const n = typeof value === "number" ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) {
    return null
  }
  return n
}

/**
 * Orders `RESULT` rows for the live leaderboard table.
 *
 * - Rows with a finite numeric `POSITION` (string or number) are sorted ascending by
 *   `POSITION`. Ties keep **stable** ordering by original index.
 * - Rows **without** a valid `POSITION` are listed **after** all positioned rows,
 *   in their original relative order (stable by index).
 * - If **no** row has a valid `POSITION`, returns non-`null` object rows in **input
 *   order** (empty array when input is empty/undefined).
 */
export function sortLeaderboardRows(rows: RawResultRow[] | undefined): RawResultRow[] {
  if (!rows?.length) {
    return []
  }

  const indexed: { row: RawResultRow; index: number }[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row === null || typeof row !== "object") {
      continue
    }
    indexed.push({ row: row as RawResultRow, index: i })
  }

  const withPos: { row: RawResultRow; index: number; pos: number }[] = []
  const withoutPos: { row: RawResultRow; index: number }[] = []

  for (const { row, index } of indexed) {
    const pos = parsePosition(row.POSITION)
    if (pos === null) {
      withoutPos.push({ row, index })
    } else {
      withPos.push({ row, index, pos })
    }
  }

  if (withPos.length === 0) {
    withoutPos.sort((a, b) => a.index - b.index)
    return withoutPos.map((x) => x.row)
  }

  withPos.sort((a, b) => {
    if (a.pos !== b.pos) {
      return a.pos - b.pos
    }
    return a.index - b.index
  })

  withoutPos.sort((a, b) => a.index - b.index)

  return [...withPos.map((x) => x.row), ...withoutPos.map((x) => x.row)]
}
