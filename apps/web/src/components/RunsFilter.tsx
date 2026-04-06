import { Sparkles } from "lucide-react"
import { type RunFilter } from "@/lib/runFilter"

type FilterChip = {
  label: string
  filter: RunFilter
}

const CHIPS: FilterChip[] = [
  { label: "All", filter: { type: "all" } },
  { label: "Success", filter: { type: "status", statuses: ["success"] } },
  { label: "Failure", filter: { type: "status", statuses: ["failure"] } },
  { label: "Timeout", filter: { type: "status", statuses: ["timeout"] } },
]

function isActive(chip: RunFilter, active: RunFilter): boolean {
  if (chip.type !== active.type) return false
  if (chip.type === "status" && active.type === "status") {
    return (
      chip.statuses.length === active.statuses.length &&
      chip.statuses.every(s => active.statuses.includes(s))
    )
  }
  return true
}

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer border"
const chipActive =
  "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
const chipInactive =
  "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:text-zinc-300"
const chipDisabled =
  "bg-white text-zinc-300 border-zinc-200 cursor-not-allowed dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800"

interface RunsFilterProps {
  filter: RunFilter
  onChange: (filter: RunFilter) => void
}

export default function RunsFilter({ filter, onChange }: RunsFilterProps) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {CHIPS.map(chip => (
          <button
            key={chip.label}
            className={`${chipBase} ${isActive(chip.filter, filter) ? chipActive : chipInactive}`}
            onClick={() => onChange(chip.filter)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}
