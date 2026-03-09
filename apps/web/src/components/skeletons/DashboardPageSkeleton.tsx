import Sk from "@/components/Sk"

const TABLE_COLUMNS = ["Name", "Endpoint", "Schedule", "Status", ""] as const

function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <Sk width="50%" height={12} />
      <Sk width="40%" height={28} />
    </div>
  )
}

function TableRowSkeleton() {
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <Sk width={120} height={14} />
          <Sk width={80} height={10} />
        </div>
      </td>
      <td className="px-4 py-3">
        <Sk width={160} height={12} />
      </td>
      <td className="px-4 py-3">
        <Sk width={80} height={12} />
      </td>
      <td className="px-4 py-3">
        <Sk width={56} height={20} className="rounded-full" />
      </td>
      <td className="px-4 py-3 text-right">
        <Sk width={48} height={24} className="ml-auto rounded" />
      </td>
    </tr>
  )
}

export default function DashboardPageSkeleton() {
  return (
    <div aria-hidden="true">
      {/* Header row */}
      <div className="mb-6 flex items-center justify-between">
        <Sk width={120} height={28} />
        <Sk width={96} height={36} className="rounded-lg" />
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Jobs table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              {TABLE_COLUMNS.map((col, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  {col !== "" && <Sk width={60} height={12} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
            <TableRowSkeleton />
          </tbody>
        </table>
      </div>
    </div>
  )
}
