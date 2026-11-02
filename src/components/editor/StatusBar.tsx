import { CircleX, TriangleAlert } from "lucide-react"
import clsx from "clsx"

export function StatusBar({
  position,
  mode,
  errors,
  warnings,
  onProblemsClick,
  saveState,
  commandsShortcut,
}: {
  position: { line: number; col: number } | null
  mode: string | null
  errors: number
  warnings: number
  onProblemsClick: () => void
  saveState: string
  commandsShortcut: string
}) {
  return (
    <div className="flex items-center gap-4 border-t border-zinc-200 px-4 py-1.5 font-mono text-xs text-zinc-500 dark:border-zinc-800">
      <button
        type="button"
        onClick={onProblemsClick}
        disabled={errors + warnings === 0}
        title="Go to next problem (F8)"
        className="flex cursor-pointer items-center gap-3 hover:text-zinc-800 disabled:cursor-default disabled:hover:text-zinc-500 dark:hover:text-zinc-200"
      >
        <span
          className={clsx(
            "flex items-center gap-1",
            errors > 0 && "text-red-500 dark:text-red-400",
          )}
        >
          <CircleX size={12} />
          {errors}
        </span>
        <span
          className={clsx(
            "flex items-center gap-1",
            warnings > 0 && "text-amber-600 dark:text-amber-400",
          )}
        >
          <TriangleAlert size={12} />
          {warnings}
        </span>
      </button>
      <span className="flex-1" />
      {position != null && (
        <span className="hidden sm:inline">
          Ln {position.line}, Col {position.col}
        </span>
      )}
      {mode != null && <span className="hidden sm:inline">{mode}</span>}
      <span>{saveState}</span>
      <span className="hidden sm:inline">{commandsShortcut} Commands</span>
    </div>
  )
}
