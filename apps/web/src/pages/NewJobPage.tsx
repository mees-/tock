import { useLocation } from "wouter"
import { useMutation } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import { JobForm, serializeHeaders } from "@/components/JobForm"
import type { JobFormValues } from "@/components/JobForm"
import { usePostHog } from "posthog-js/react"

const CreateJobMutation = graphql(`
  mutation CreateJob($input: CreateJobInput!) {
    createJob(input: $input) {
      id
    }
  }
`)

export default function NewJobPage() {
  const [, navigate] = useLocation()
  const [, createJob] = useMutation(CreateJobMutation)
  const posthog = usePostHog()

  async function handleSubmit(values: JobFormValues) {
    const result = await createJob({
      input: {
        name: values.name,
        description: values.description || undefined,
        endpoint: values.endpoint,
        method: values.method,
        headers: serializeHeaders(values.headers),
        body: values.body ?? undefined,
        cronExpression: values.cronExpression,
      },
    })

    if (result.error != null) {
      throw new Error(
        result.error.graphQLErrors[0]?.message ?? "Failed to create job",
      )
    }

    posthog.capture("job_created", {
      method: values.method,
      cron_expression: values.cronExpression,
      has_body: values.body != null && values.body !== "",
      has_headers: values.headers.some(h => h.key.trim() !== ""),
      has_description: values.description !== "",
    })

    const id = result.data?.createJob.id
    navigate(id != null ? `/jobs/${id}` : "/dashboard")
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        New job
      </h1>
      <JobForm onSubmit={handleSubmit} />
    </div>
  )
}
