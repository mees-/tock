const JOB_STATUSES = ["active", "flaky", "failing", "paused"] as const
const RUN_STATUSES = ["success", "failure", "timeout"] as const

export type JobStatus = (typeof JOB_STATUSES)[number]
export type RunStatus = (typeof RUN_STATUSES)[number]

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as ReadonlyArray<string>).includes(value)
}

export function isRunStatus(value: string): value is RunStatus {
  return (RUN_STATUSES as ReadonlyArray<string>).includes(value)
}
