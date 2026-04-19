import type { LapsDataRow } from "@/lib/lapTimes"

const LIVETIMING_ORIGIN = "https://livetiming.azurewebsites.net"

/** Typical JSON shapes returned by `GET /event/:eventId/laps-data`. */
export type LapsDataHttpPayload =
  | LapsDataRow[]
  | {
      DATA?: LapsDataRow[]
      data?: LapsDataRow[]
      laps?: LapsDataRow[]
      LAPS?: LapsDataRow[]
      LapTimes?: LapsDataRow[]
      RESULT?: LapsDataRow[]
      rows?: LapsDataRow[]
      [key: string]: LapsDataRow[] | unknown
    }

export async function getLapsData(
  eventId: string,
  session: string,
  startingNo: string | number
): Promise<LapsDataHttpPayload> {
  const url = new URL(`${LIVETIMING_ORIGIN}/event/${eventId}/laps-data`)
  url.searchParams.set("session", session)
  url.searchParams.set("startingNo", String(startingNo))
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) {
    throw new Error(`getLapsData failed: ${res.status}`)
  }
  return res.json()
}
