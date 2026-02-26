import { useEffect } from "react"
import { Link } from "wouter"
import { useQuery, useMutation } from "urql"
import { Plus } from "lucide-react"
import { graphql } from "@/lib/graphql/graphql"
import { smallestCronIntervalMs } from "@/lib/cronInterval"
import { isJobStatus } from "@/lib/typeGuards"
import StatsCard from "@/components/StatsCard"
import StatusBadge from "@/components/StatusBadge"

const DashboardQuery = graphql(`
  query Dashboard {
    stats {
      totalJobs
      activeJobs
      totalRunsToday
      successRateLast24h
      avgDurationLast24h
    }
    jobs {
      id
      name
      description
      endpoint
      method
      cronExpression
      isActive
      status
    }
  }
`)

const ToggleJobMutation = graphql(`
  mutation ToggleJob($id: Int!) {
    toggleJob(id: $id) {
      id
      isActive
    }
  }
`)

export default function DashboardPage() {
  const [{ data, fetching }, reexecuteQuery] = useQuery({ query: DashboardQuery })
  const [, toggleJob] = useMutation(ToggleJobMutation)

  const jobs = data?.jobs ?? []
  const activeExpressions = jobs.filter(j => j.isActive).map(j => j.cronExpression)
  const intervalMs = smallestCronIntervalMs(activeExpressions)

  useEffect(() => {
    const timer = setInterval(() => {
      reexecuteQuery({ requestPolicy: "network-only" })
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, reexecuteQuery])

  const successPct = data?.stats != null ? `${(data.stats.successRateLast24h * 100).toFixed(1)}%` : "—"
  const avgDuration = data?.stats?.avgDurationLast24h != null ? `${Math.round(data.stats.avgDurationLast24h)}ms` : "—"

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Dashboard</h1>
        <Link
          href="/jobs/new"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          <Plus size={16} />
          New job
        </Link>
      </div>

      {fetching && data == null ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard label="Total jobs" value={data?.stats.totalJobs ?? 0} />
            <StatsCard label="Active jobs" value={data?.stats.activeJobs ?? 0} />
            <StatsCard label="Runs today" value={data?.stats.totalRunsToday ?? 0} />
            <StatsCard label="Success rate (24h)" value={successPct} sub={`Avg ${avgDuration}`} />
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-zinc-500">No jobs yet.</p>
              <Link
                href="/jobs/new"
                className="mt-3 inline-block text-sm text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Create your first job
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                    <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Endpoint</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Schedule</th>
                    <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {jobs.map(job => (
                    <tr key={job.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="font-medium text-zinc-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                        >
                          {job.name}
                        </Link>
                        {job.description !== "" && <p className="mt-0.5 text-xs text-zinc-500">{job.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {job.method} {job.endpoint}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {job.cronExpression}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={isJobStatus(job.status) ? job.status : "active"} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={async () => {
                            await toggleJob({ id: job.id })
                            reexecuteQuery({ requestPolicy: "network-only" })
                          }}
                          className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          {job.isActive ? "Pause" : "Resume"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
