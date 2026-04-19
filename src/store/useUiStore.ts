import { create } from "zustand"

export type UiSlice = {
  selectedStartingNo: string | null
  setSelectedStartingNo: (stnr: string) => void
  closeDrilldown: () => void
}

export const useUiStore = create<UiSlice>((set) => ({
  selectedStartingNo: null,
  setSelectedStartingNo: (stnr) => set({ selectedStartingNo: stnr }),
  closeDrilldown: () => set({ selectedStartingNo: null }),
}))
