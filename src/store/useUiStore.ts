import { create } from "zustand"

export type UiSlice = {
  selectedStartingNo: string | null
  setSelectedStartingNo: (stnr: string) => void
  closeDrilldown: () => void
  settingsDrawerOpen: boolean
  setSettingsDrawerOpen: (open: boolean) => void
}

export const useUiStore = create<UiSlice>((set) => ({
  selectedStartingNo: null,
  setSelectedStartingNo: (stnr) => set({ selectedStartingNo: stnr }),
  closeDrilldown: () => set({ selectedStartingNo: null }),
  settingsDrawerOpen: false,
  setSettingsDrawerOpen: (open) => set({ settingsDrawerOpen: open }),
}))
