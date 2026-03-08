export default function Sk({
  w,
  h,
  className = "",
}: {
  w: string | number
  h: string | number
  className?: string
}) {
  return (
    <div
      className={`animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 ${className}`}
      style={{ width: w, height: h }}
    />
  )
}
