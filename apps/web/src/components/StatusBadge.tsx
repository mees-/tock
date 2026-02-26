type Status = "success" | "failure" | "timeout" | "active" | "flaky" | "failing" | "paused"

const styles: Record<Status, string> = {
  success:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800",
  failure: "bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800",
  timeout:
    "bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800",
  active:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800",
  flaky:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800",
  failing: "bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800",
  paused: "bg-zinc-100 text-zinc-500 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
}

const labels: Record<Status, string> = {
  success: "Success",
  failure: "Failure",
  timeout: "Timeout",
  active: "Active",
  flaky: "Flaky",
  failing: "Failing",
  paused: "Paused",
}

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}
