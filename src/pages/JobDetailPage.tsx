import { useMemo } from "react"
import { useParams, useLocation, useSearch } from "wouter"
import { useQuery } from "@tanstack/react-query"
import { api, queryClient, unwrap } from "@/lib/api"
import type { Job } from "@/lib/api"

import RunsTable from "@/components/RunsTable"
import RunsFilter from "@/components/RunsFilter"
import { JobForm, headersToRecord } from "@/components/JobForm"
import type { JobFormValues } from "@/components/JobForm"
import { usePostHog } from "posthog-js/react"
import {
  parseRunFilter,
  serializeRunFilter,
  type RunFilter,
} from "@/lib/runFilter"

function toFormValues(job: Job): JobFormValues {
  return {
    name: job.name,
    description: job.description,
    endpoint: job.endpoint,
    method: job.method,
    cronExpression: job.cronExpression,
    headers: Object.entries(job.headers).map(([key, value]) => ({
      key,
      value,
    })),
    body: job.body,
  }
}

function invalidateJobs() {
  void queryClient.invalidateQueries({ queryKey: ["jobs"] })
  void queryClient.invalidateQueries({ queryKey: ["me"] })
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>()
  const [location, navigate] = useLocation()
  const search = useSearch()
  const id = Number(params.id)
  const posthog = usePostHog()

  const activeFilter: RunFilter = useMemo(
    () => parseRunFilter(search),
    [search],
  )

  const resolvedStatuses = useMemo((): string[] | undefined => {
    if (activeFilter.type === "all") return undefined
    if (activeFilter.type === "status") return activeFilter.statuses
  }, [activeFilter])

  function handleFilterChange(filter: RunFilter) {
    const qs = serializeRunFilter(filter)
    const url = new URL(window.location.href)
    const existingQs = url.searchParams
    if (qs != null) {
      qs.forEach((value, key) => existingQs.set(key, value))
      url.search = existingQs.toString()
      navigate(url.pathname + url.search)
    } else {
      existingQs.delete("filter")
      url.search = existingQs.toString()
      navigate(location.split("?")[0])
    }
  }

  const param = { id: String(id) }
  const { data: job, isPending } = useQuery({
    queryKey: ["jobs", id],
    queryFn: () => unwrap(api.jobs[":id"].$get({ param })),
  })

  if (isPending) return <p className="text-zinc-500">Loading…</p>
  if (job == null)
    return <p className="text-red-500 dark:text-red-400">Job not found</p>

  async function handleToggle() {
    const toggled = await unwrap(api.jobs[":id"].toggle.$post({ param }))
    posthog.capture("job_toggled", { job_id: id, active: toggled.isActive })
    invalidateJobs()
  }

  async function handleDelete() {
    if (job == null) return
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return
    await unwrap(api.jobs[":id"].$delete({ param }))
    posthog.capture("job_deleted", { job_id: id })
    queryClient.removeQueries({ queryKey: ["jobs", id] })
    invalidateJobs()
    navigate("/dashboard")
  }

  async function handleSubmit(values: JobFormValues) {
    await unwrap(
      api.jobs[":id"].$patch({
        param,
        json: {
          name: values.name,
          description: values.description,
          endpoint: values.endpoint,
          method: values.method,
          headers: headersToRecord(values.headers),
          body: values.body,
          cronExpression: values.cronExpression,
        },
      }),
    )
    invalidateJobs()
  }

  return (
    <div>
      <div className="mb-8">
        <JobForm
          jobId={job.id}
          isActive={job.isActive}
          initialValues={toFormValues(job)}
          onSubmit={handleSubmit}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      </div>

      {/* Run history */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Run history
        </h2>
        <RunsFilter filter={activeFilter} onChange={handleFilterChange} />
        <RunsTable jobId={id} statuses={resolvedStatuses} />
      </div>
    </div>
  )
}
