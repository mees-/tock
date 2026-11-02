import clsx from "clsx"

/** Matches the `leading-6` line height used throughout the editor. */
export const LINE_HEIGHT_PX = 24

/**
 * One or more editor lines with line numbers in a gutter. `activeLine` and
 * `problemLines` index into the block's own lines.
 */
export function EditorLine({
  number,
  count = 1,
  activeLine,
  problemLines,
  className,
  onClick,
  children,
}: {
  number: number | null
  count?: number
  activeLine?: number | null
  problemLines?: number[]
  className?: string
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  children: React.ReactNode
}) {
  return (
    <div className={clsx("relative flex", className)} onClick={onClick}>
      {activeLine != null && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bg-zinc-100/80 dark:bg-white/[0.04]"
          style={
            count === 1
              ? { top: 0, bottom: 0 }
              : { top: activeLine * LINE_HEIGHT_PX, height: LINE_HEIGHT_PX }
          }
        />
      )}
      <div
        aria-hidden
        className="relative w-12 shrink-0 cursor-default select-none pr-4 text-right tabular-nums"
      >
        {number != null &&
          Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className={clsx(
                problemLines?.includes(i)
                  ? "text-red-500 dark:text-red-400"
                  : i === activeLine
                    ? "text-zinc-600 dark:text-zinc-300"
                    : "text-zinc-300 dark:text-zinc-600",
              )}
            >
              {number + i}
            </div>
          ))}
      </div>
      <div className="relative min-w-0 flex-1 pr-5">{children}</div>
    </div>
  )
}
