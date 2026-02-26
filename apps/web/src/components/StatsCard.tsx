import AnimatedNumber from "./AnimatedNumber"

export default function StatsCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
        <AnimatedNumber value={value} />
      </p>
      {sub != null && (
        <p className="mt-1 text-xs text-zinc-500">
          <AnimatedNumber value={sub} />
        </p>
      )}
    </div>
  )
}
