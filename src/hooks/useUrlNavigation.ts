import type { AppTab, UiLang } from "@/hooks/useUrlConfig"
import { replaceSearchParams } from "@/lib/patchSearchParams"

export function setUrlTab(tab: AppTab): void {
  replaceSearchParams((p) => {
    if (tab === "leaderboard") {
      p.delete("tab")
    } else {
      p.set("tab", tab)
    }
  })
}

export function setUrlLang(lang: UiLang): void {
  replaceSearchParams((p) => {
    if (lang === "de") {
      p.delete("lang")
    } else {
      p.set("lang", lang)
    }
  })
}
