import { useEffect } from "react"
import { useParams, useLocation } from "wouter"
import { useQuery, useMutation } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import { smallestCronIntervalMs } from "@/lib/cronInterval"
import RunsTable from "@/components/RunsTable"
import { JobForm, serializeHeaders } from "@/components/JobForm"
import type { JobFormValues } from "@/components/JobForm"
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
      isActive
      status
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

const UpdateJobMutation = graphql(`
  mutation UpdateJobDetail($input: UpdateJobInput!) {
    updateJob(input: $input) {
      id
      name
      description
      endpoint
      method
      headers
      body
      cronExpression
    }
  }
`)

function toFormValues(job: {
  name: string
  description: string
  endpoint: string
  method: string
  headers: string
  body?: string | null
  cronExpression: string
}): JobFormValues {
  const parsed = JSON.parse(job.headers) as Record<string, string>
  return {
    name: job.name,
    description: job.description,
    endpoint: job.endpoint,
    method: job.method as JobFormValues["method"],
    cronExpression: job.cronExpression,
    headers: Object.entries(parsed).map(([key, value]) => ({ key, value })),
    body: job.body ?? null,
  }
}

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
  const [, updateJob] = useMutation(UpdateJobMutation)

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

  async function handleToggle() {
    const result = await toggleJob({ id })
    if (result.data != null) {
      posthog.capture("job_toggled", {
        job_id: id,
        active: result.data.toggleJob.isActive,
      })
    }
    reexecuteQuery({ requestPolicy: "network-only" })
  }

  async function handleDelete() {
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return
    const result = await deleteJob({ id })
    if (result.error == null) {
      posthog.capture("job_deleted", { job_id: id })
    }
    navigate("/dashboard")
  }

  async function handleSubmit(values: JobFormValues) {
    const result = await updateJob({
      input: {
        id,
        name: values.name,
        description: values.description,
        endpoint: values.endpoint,
        method: values.method,
        headers: serializeHeaders(values.headers),
        body: values.body,
        cronExpression: values.cronExpression,
      },
    })

    if (result.error != null) {
      throw new Error(
        result.error.graphQLErrors[0]?.message ?? "Failed to save",
      )
    }

    reexecuteQuery({ requestPolicy: "network-only" })
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
        <RunsTable jobId={id} pollIntervalMs={intervalMs} />
      </div>
    </div>
  )
}
