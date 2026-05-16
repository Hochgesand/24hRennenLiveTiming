/** Per-car SVG path-length motion state (constant velocity between anchor updates). */
export type MarkerMotionState = {
  displayedLen: number
  heldVelocity: number
  anchorTimeMs: number
}

export const DEFAULT_CATCH_UP_SEC = 1.0

export function wrapPathLength(len: number, totalLength: number): number {
  if (totalLength <= 0) {
    return 0
  }
  const wrapped = len % totalLength
  return wrapped < 0 ? wrapped + totalLength : wrapped
}

/** Shortest signed delta along a closed path (negative = behind target). */
export function shortestSignedDelta(from: number, to: number, totalLength: number): number {
  if (totalLength <= 0) {
    return to - from
  }
  let delta = to - from
  if (delta > totalLength / 2) {
    delta -= totalLength
  }
  if (delta < -totalLength / 2) {
    delta += totalLength
  }
  return delta
}

export function projectTargetDistanceM(
  anchorDistanceM: number,
  predictedVelocityMps: number,
  elapsedSec: number,
  maxProjectedDistanceM: number,
): number {
  const projected = anchorDistanceM + predictedVelocityMps * Math.max(0, elapsedSec)
  return Math.min(projected, maxProjectedDistanceM)
}

/**
 * Advance marker motion by one frame: integrate held velocity, then on a fresh
 * anchor recompute velocity so the gap to `targetLen` closes over `catchUpSec`.
 */
export function advanceMarkerState(
  prev: MarkerMotionState | undefined,
  params: {
    targetLen: number
    predictedVel: number
    anchorTimeMs: number
    dtSec: number
    totalLength: number
    catchUpSec: number
  },
): MarkerMotionState {
  const { targetLen, predictedVel, anchorTimeMs, dtSec, totalLength, catchUpSec } = params

  if (!prev || totalLength <= 0) {
    return {
      displayedLen: wrapPathLength(targetLen, totalLength),
      heldVelocity: predictedVel,
      anchorTimeMs,
    }
  }

  const displayedLen = wrapPathLength(prev.displayedLen + prev.heldVelocity * dtSec, totalLength)
  let heldVelocity = prev.heldVelocity
  let storedAnchorTimeMs = prev.anchorTimeMs

  if (anchorTimeMs !== prev.anchorTimeMs) {
    const error = shortestSignedDelta(displayedLen, targetLen, totalLength)
    heldVelocity = predictedVel + error / catchUpSec
    storedAnchorTimeMs = anchorTimeMs
  }

  return {
    displayedLen,
    heldVelocity,
    anchorTimeMs: storedAnchorTimeMs,
  }
}
