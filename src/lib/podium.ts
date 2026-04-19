import type { RawResultRow } from "@/domain"

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
 * Returns podium slots P1–P3 from raw `RESULT` rows, sorted by `POSITION` ascending.
 * Rows without a numeric `POSITION` are skipped.
 */
export function getPodiumRows(
  results: RawResultRow[] | undefined
): [RawResultRow | null, RawResultRow | null, RawResultRow | null] {
  const empty: [RawResultRow | null, RawResultRow | null, RawResultRow | null] = [
    null,
    null,
    null,
  ]
  if (!results?.length) {
    return empty
  }

  const withPos: { pos: number; row: RawResultRow }[] = []
  for (const item of results) {
    if (item === null || typeof item !== "object") {
      continue
    }
    const row = item as RawResultRow
    const pos = parsePosition(row.POSITION)
    if (pos === null) {
      continue
    }
    withPos.push({ pos, row })
  }

  withPos.sort((a, b) => a.pos - b.pos)

  return [
    withPos[0]?.row ?? null,
    withPos[1]?.row ?? null,
    withPos[2]?.row ?? null,
  ]
}
