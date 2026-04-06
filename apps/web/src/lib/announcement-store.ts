import { create } from "zustand"
import { persist } from "zustand/middleware"

interface AnnouncementState {
  firstVisitAt: string | null
  seenIds: string[]
  initFirstVisitAt: () => void
  markSeen: (id: string) => void
  markAllSeen: (ids: string[]) => void
}

export const useAnnouncementStore = create<AnnouncementState>()(
  persist(
    set => ({
      firstVisitAt: null,
      seenIds: [],
      initFirstVisitAt: () =>
        set(state => {
          if (state.firstVisitAt != null) return {}
          return { firstVisitAt: new Date().toISOString() }
        }),
      markSeen: (id: string) =>
        set(state => ({ seenIds: [...state.seenIds, id] })),
      markAllSeen: (ids: string[]) =>
        set(state => ({
          seenIds: [...new Set([...state.seenIds, ...ids])],
        })),
    }),
    { name: "tock-announcements" },
  ),
)
