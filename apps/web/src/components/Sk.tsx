export default function Sk({
  width,
  height,
  className = "",
}: {
  width: string | number
  height: string | number
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 ${className}`.trim()}
      style={{ width, height }}
    />
  )
}
