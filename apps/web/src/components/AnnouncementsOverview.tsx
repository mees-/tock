import { X, Megaphone } from "lucide-react"
import { useEffect } from "react"
import announcements from "@/lib/announcements.json"
import { useAnnouncementStore } from "@/lib/announcement-store"

interface Props {
  open: boolean
  onClose: () => void
}

export default function AnnouncementsOverview({ open, onClose }: Props) {
  const seenIds = useAnnouncementStore(s => s.seenIds)
  const markAllSeen = useAnnouncementStore(s => s.markAllSeen)

  useEffect(() => {
    if (open) markAllSeen(announcements.map(a => a.id))
  }, [open, markAllSeen])

  const sorted = announcements
    .slice()
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))

  if (!open) return null

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50"
        onClick={onClose}
      />

      {/* modal */}
      <div className="fixed left-1/2 top-1/2 z-50 flex w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 max-h-[80vh]">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
            <Megaphone
              size={16}
              className="text-emerald-500 dark:text-emerald-400"
            />
            What&apos;s new
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
          {sorted.map(a => {
            const seen = seenIds.includes(a.id)
            return (
              <div key={a.id} className="px-5 py-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p
                    className={`text-sm font-semibold text-zinc-900 dark:text-white`}
                  >
                    {a.title}
                  </p>
                  <time
                    className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500"
                    dateTime={a.publishedAt}
                  >
                    {new Date(a.publishedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
                <p
                  className={`text-sm ${seen ? "text-zinc-400 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  {a.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
