import { Megaphone, X } from "lucide-react"
import announcements from "@/lib/announcements.json"
import { useAnnouncementStore } from "@/lib/announcement-store"

interface Props {
  onViewAll: () => void
}

export default function AnnouncementToast({ onViewAll }: Props) {
  const firstVisitAt = useAnnouncementStore(s => s.firstVisitAt)
  const seenIds = useAnnouncementStore(s => s.seenIds)
  const markSeen = useAnnouncementStore(s => s.markSeen)

  const announcement = announcements
    .slice()
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .find(
      a =>
        firstVisitAt != null &&
        firstVisitAt < a.publishedAt &&
        !seenIds.includes(a.id),
    )

  if (announcement == null) return null

  return (
    <div className="fixed bottom-16 left-4 z-50 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <Megaphone size={13} />
            What&apos;s new
          </div>
          <button
            onClick={() => markSeen(announcement.id)}
            className="cursor-pointer rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X size={14} />
          </button>
        </div>
        <p className="mb-0.5 text-sm font-semibold text-zinc-900 dark:text-white">
          {announcement.title}
        </p>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          {announcement.description}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => markSeen(announcement.id)}
            className="cursor-pointer rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            Got it
          </button>
          <button
            onClick={() => {
              markSeen(announcement.id)
              onViewAll()
            }}
            className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            View all
          </button>
        </div>
      </div>
    </div>
  )
}
