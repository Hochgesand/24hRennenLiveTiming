/** Updates the current URL search string, preserving path + hash. */
export function replaceSearchParams(mutate: (p: URLSearchParams) => void): void {
  const params = new URLSearchParams(window.location.search)
  mutate(params)
  const qs = params.toString()
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    history.replaceState(history.state, "", next)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }
}
