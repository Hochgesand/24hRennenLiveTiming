import { create } from "zustand"

import type { Pid0Frame, Pid3Frame, Pid4Frame, Pid501Frame, Pid9002Frame } from "@/domain"

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error" | "closed"

export type ConnectionSlice = {
  status: ConnectionStatus
  error: string | null
  /** Milliseconds to add to `Date.now()` for server-aligned clock (from LTS_TIMESYNC). */
  remoteTimeDiffMs: number
}

type LiveState = {
  connection: ConnectionSlice
  /** Session-oriented fields from PID 0 (leaderboard snapshot header). */
  sessionMeta: Pid0Frame | null
  /** Track/session clock from PID 4. */
  track: Pid4Frame | null
  /** Race control messages from PID 3. */
  messages: Pid3Frame | null
  topQualifying: Pid501Frame | null
  statistics: Pid9002Frame | null
  setConnection: (partial: Partial<ConnectionSlice>) => void
  setSessionMeta: (frame: Pid0Frame | null) => void
  setTrack: (frame: Pid4Frame | null) => void
  setMessages: (frame: Pid3Frame | null) => void
  setTopQualifying: (frame: Pid501Frame | null) => void
  setStatistics: (frame: Pid9002Frame | null) => void
  setRemoteTimeDiffMs: (ms: number) => void
}

export const useLiveStore = create<LiveState>((set) => ({
  connection: {
    status: "idle",
    error: null,
    remoteTimeDiffMs: 0,
  },
  sessionMeta: null,
  track: null,
  messages: null,
  topQualifying: null,
  statistics: null,
  setConnection: (partial) =>
    set((s) => ({
      connection: { ...s.connection, ...partial },
    })),
  setSessionMeta: (frame) => set({ sessionMeta: frame }),
  setTrack: (frame) => set({ track: frame }),
  setMessages: (frame) => set({ messages: frame }),
  setTopQualifying: (frame) => set({ topQualifying: frame }),
  setStatistics: (frame) => set({ statistics: frame }),
  setRemoteTimeDiffMs: (ms) =>
    set((s) => ({
      connection: { ...s.connection, remoteTimeDiffMs: ms },
    })),
}))
