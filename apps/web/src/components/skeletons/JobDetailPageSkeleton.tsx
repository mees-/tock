import Sk from "@/components/Sk"

const RUN_HISTORY_COLUMN_AMOUNT = 4

function RunRowSkeleton() {
  return (
    <tr>
      <td className="px-4 py-3">
        <Sk width={140} height={12} />
      </td>
      <td className="px-4 py-3">
        <Sk width={56} height={20} className="rounded-full" />
      </td>
      <td className="px-4 py-3">
        <Sk width={40} height={12} />
      </td>
      <td className="px-4 py-3 text-right">
        <Sk width={60} height={12} className="ml-auto" />
      </td>
    </tr>
  )
}

export default function JobDetailPageSkeleton() {
  return (
    <div aria-hidden="true">
      {/* Form area */}
      <div className="mb-8 flex flex-col gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <Sk width={40} height={12} />
          <Sk width="100%" height={36} className="rounded-lg" />
        </div>
        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Sk width={72} height={12} />
          <Sk width="100%" height={36} className="rounded-lg" />
        </div>
        {/* Method + Endpoint */}
        <div className="flex gap-3">
          <div className="flex w-28 flex-col gap-1.5">
            <Sk width={48} height={12} />
            <Sk width="100%" height={36} className="rounded-lg" />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Sk width={56} height={12} />
            <Sk width="100%" height={36} className="rounded-lg" />
          </div>
        </div>
        {/* Schedule */}
        <div className="flex flex-col gap-1.5">
          <Sk width={64} height={12} />
          <Sk width="100%" height={36} className="rounded-lg" />
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Sk width={96} height={36} className="rounded-lg" />
          <Sk width={80} height={36} className="rounded-lg" />
          <Sk width={80} height={36} className="ml-auto rounded-lg" />
        </div>
      </div>

      {/* Run history */}
      <div>
        <Sk width={96} height={12} className="mb-4" />
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                {new Array(RUN_HISTORY_COLUMN_AMOUNT).map((_, i) => (
                  <th key={i} className="px-4 py-3 text-left">
                    <Sk width={70} height={12} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <RunRowSkeleton />
              <RunRowSkeleton />
              <RunRowSkeleton />
              <RunRowSkeleton />
              <RunRowSkeleton />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
