/**
 * Offline track-map jump histogram.
 *
 * Loads the fixture captured by the Playwright script
 * (`src/lib/__fixtures__/trackmap.event50.json`) and replays every PID 0
 * sample through the rewritten `computeTrackDrivers`, using each sample's
 * own `at` timestamp as `Date.now()` so elapsed-time math matches what the
 * UI sees at capture time. Prints the jump histogram and per-bucket details.
 *
 * Usage:
 *   npm run replay:trackmap
 * or
 *   npx tsx scripts/replay-trackmap.ts [path/to/fixture.json]
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

import type { Pid0Frame, RawResultRow } from "../src/lib/types.js"
import { computeTrackDrivers, type TrackTimingHistory } from "../src/lib/trackTiming.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultFixture = path.resolve(
  __dirname,
  "../src/lib/__fixtures__/trackmap.event50.json",
)
const fixturePath = process.argv[2] ?? defaultFixture

let fixture: {
  session: Pid0Frame
  pathLength: number
  samples: Array<{
    at: number
    remoteTimeDiffMs: number
    trackState: string
    rows: RawResultRow[]
  }>
}

try {
  fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as typeof fixture
} catch (err) {
  console.error(`Cannot load fixture: ${fixturePath}\n${err}`)
  process.exit(1)
}

const { session, pathLength, samples } = fixture
const trackLength = Number(session.TRACKLENGTH)

console.log(`\nReplay: ${fixturePath}`)
console.log(`Track length: ${trackLength} m  SVG path: ${pathLength.toFixed(1)} units`)
console.log(`Samples: ${samples.length}  Visible markers approx: ${samples[0]?.rows.length ?? 0}`)

const BUCKETS = [
  { label: "> 5  units", min: 5 },
  { label: ">10  units", min: 10 },
  { label: ">20  units", min: 20 },
  { label: ">40  units", min: 40 },
  { label: ">80  units", min: 80 },
  { label: ">150 units", min: 150 },
]

const bucketCounts = BUCKETS.map(() => 0)
const largestJumps: Array<{
  stnr: string
  delta: number
  prevAt: number
  at: number
  prevLen: number
  newLen: number
}> = []

const prevState = new Map<string, { len: number; at: number }>()
const history: TrackTimingHistory = new Map()

let nowMock = 0
const _origNow = Date.now.bind(Date)
Date.now = () => nowMock

for (const sample of samples) {
  const { at, remoteTimeDiffMs, trackState, rows } = sample
  nowMock = at

  const pid0: Pid0Frame = {
    ...session,
    TRACKSTATE: trackState,
    RESULT: rows,
  }

  const markers = computeTrackDrivers({
    session: pid0,
    trackState,
    remoteTimeDiffMs,
    trackPathLength: pathLength,
    history,
  })

  for (const marker of markers) {
    if (!marker.visible) {
      prevState.delete(marker.startingNumber)
      continue
    }

    const svgLen = marker.pathFraction * pathLength
    const prev = prevState.get(marker.startingNumber)

    if (prev) {
      const dt = (at - prev.at) / 1000
      let delta = Math.abs(svgLen - prev.len)
      if (delta > pathLength / 2) delta = pathLength - delta // seam wrap

      if (dt <= 2) {
        for (let i = 0; i < BUCKETS.length; i++) {
          if (delta > BUCKETS[i].min) bucketCounts[i]++
        }
        if (delta > 40) {
          largestJumps.push({
            stnr: marker.startingNumber,
            delta,
            prevAt: prev.at,
            at,
            prevLen: prev.len,
            newLen: svgLen,
          })
        }
      }
    }

    prevState.set(marker.startingNumber, { len: svgLen, at })
  }
}

Date.now = _origNow

console.log("\n── Jump histogram (per-car, between consecutive ≤2 s samples) ──")
for (let i = 0; i < BUCKETS.length; i++) {
  const bar = "█".repeat(Math.min(50, Math.ceil(bucketCounts[i] / 4)))
  console.log(`  ${BUCKETS[i].label.padEnd(14)}  ${String(bucketCounts[i]).padStart(4)}  ${bar}`)
}

const bigJumps = largestJumps.sort((a, b) => b.delta - a.delta).slice(0, 20)
if (bigJumps.length > 0) {
  console.log("\n── Top jumps >40 SVG units ──")
  for (const j of bigJumps) {
    console.log(
      `  #${j.stnr.padEnd(5)}  Δ${j.delta.toFixed(1).padStart(6)} units` +
        `  ${j.prevLen.toFixed(0)} → ${j.newLen.toFixed(0)}` +
        `  dt=${((j.at - j.prevAt) / 1000).toFixed(1)}s`,
    )
  }
} else {
  console.log("\nNo jumps >40 SVG units detected. ✓")
}

console.log(
  `\nResult: ${bucketCounts[3]} jump(s) >40 SVG units` +
    ` (baseline pre-fix: ~199)\n`,
)
