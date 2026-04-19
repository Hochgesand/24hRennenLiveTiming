/**
 * Subscribe to `MediaQueryList` changes. Uses `addEventListener` when available,
 * otherwise legacy `addListener` (older WebKit / embedded webviews).
 */
export function subscribeMediaQueryChange(
  mq: MediaQueryList,
  onChange: () => void,
): () => void {
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }
  const legacy = onChange as (this: MediaQueryList) => void
  mq.addListener(legacy)
  return () => mq.removeListener(legacy)
}
