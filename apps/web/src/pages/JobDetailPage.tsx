import { useEffect } from "react"
import { useParams, useLocation } from "wouter"
import { useQuery, useMutation } from "urql"
import { Trash2, Play, Pause } from "lucide-react"
import { graphql } from "@/lib/graphql/graphql"
import { smallestCronIntervalMs } from "@/lib/cronInterval"
import { parseJson } from "@/lib/parseJson"
import { isJobStatus } from "@/lib/typeGuards"
import StatusBadge from "@/components/StatusBadge"
import RunsTable from "@/components/RunsTable"
import { usePostHog } from "posthog-js/react"

const JobDetailQuery = graphql(`
  query JobDetail($id: Int!) {
    job(id: $id) {
      id
      name
      description
      endpoint
      method
      headers
      body
      cronExpression
      timezone
      isActive
      status
      runs(amount: 50) {
        id
        triggeredAt
        status
        httpStatusCode
        durationMs
        responseBody
        responseHeaders
        errorMessage
      }
    }
  }
`)

const ToggleJobMutation = graphql(`
  mutation ToggleJobDetail($id: Int!) {
    toggleJob(id: $id) {
      id
      isActive
    }
  }
`)

const DeleteJobMutation = graphql(`
  mutation DeleteJob($id: Int!) {
    deleteJob(id: $id)
  }
`)

export default function JobDetailPage() {
  const params = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const id = Number(params.id)
  const posthog = usePostHog()

  const [{ data, fetching }, reexecuteQuery] = useQuery({
    query: JobDetailQuery,
    variables: { id },
  })

  const [, toggleJob] = useMutation(ToggleJobMutation)
  const [, deleteJob] = useMutation(DeleteJobMutation)

  const cronExpression = data?.job?.cronExpression
  const intervalMs =
    cronExpression != null ? smallestCronIntervalMs([cronExpression]) : 60_000

  useEffect(() => {
    const timer = setInterval(() => {
      reexecuteQuery({ requestPolicy: "network-only" })
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, reexecuteQuery])

  if (fetching && data == null) return <p className="text-zinc-500">Loading…</p>
  if (data?.job == null)
    return <p className="text-red-500 dark:text-red-400">Job not found</p>

  const { job } = data
  const runs = job.runs

  async function handleDelete() {
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return
    const result = await deleteJob({ id })
    if (result.error == null) {
      posthog.capture("job_deleted", { job_id: id })
    }
    navigate("/jobs")
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {job.name}
          </h1>
          {job.description !== "" && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {job.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const result = await toggleJob({ id })
              if (result.data != null) {
                posthog.capture("job_toggled", {
                  job_id: id,
                  active: result.data.toggleJob.isActive,
                })
              }
              reexecuteQuery({ requestPolicy: "network-only" })
            }}
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
          >
            {job.isActive ? <Pause size={14} /> : <Play size={14} />}
            {job.isActive ? "Pause" : "Resume"}
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="mb-8 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Configuration
        </h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <ConfigRow label="Status">
            <StatusBadge
              status={isJobStatus(job.status) ? job.status : "active"}
            />
          </ConfigRow>
          <ConfigRow label="Method & Endpoint">
            <span className="font-mono">
              {job.method} {job.endpoint}
            </span>
          </ConfigRow>
          <ConfigRow label="Schedule">
            <span className="font-mono">{job.cronExpression}</span>
          </ConfigRow>
          <ConfigRow label="Timezone">{job.timezone}</ConfigRow>
          {Object.keys(parseJson<Record<string, string>>(job.headers) ?? {})
            .length > 0 && (
            <ConfigRow label="Headers" className="col-span-2">
              <pre className="overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">
                {job.headers}
              </pre>
            </ConfigRow>
          )}
          {job.body != null && (
            <ConfigRow label="Body" className="col-span-2">
              <pre className="overflow-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">
                {job.body}
              </pre>
            </ConfigRow>
          )}
        </div>
      </div>

      {/* Run history */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Run history
        </h2>
        <RunsTable runs={runs} jobId={id} />
      </div>
    </div>
  )
}

function ConfigRow({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <dt className="mb-1 text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="text-zinc-800 dark:text-zinc-200">{children}</dd>
    </div>
  )
}
