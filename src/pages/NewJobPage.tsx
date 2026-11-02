import { useLocation } from "wouter"
import { api, queryClient, unwrap } from "@/lib/api"
import { JobForm, headersToRecord } from "@/components/JobForm"
import type { JobFormValues } from "@/components/JobForm"
import { usePostHog } from "posthog-js/react"

export default function NewJobPage() {
  const [, navigate] = useLocation()
  const posthog = usePostHog()

  async function handleSubmit(values: JobFormValues) {
    const job = await unwrap(
      api.jobs.$post({
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
    void queryClient.invalidateQueries({ queryKey: ["jobs"] })
    void queryClient.invalidateQueries({ queryKey: ["me"] })

    posthog.capture("job_created", {
      method: values.method,
      cron_expression: values.cronExpression,
      has_body: values.body != null && values.body !== "",
      has_headers: Object.keys(headersToRecord(values.headers)).length > 0,
      has_description: values.description !== "",
    })

    navigate(`/jobs/${job.id}`)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        New job
      </h1>
      <JobForm onSubmit={handleSubmit} />
    </div>
  )
}
