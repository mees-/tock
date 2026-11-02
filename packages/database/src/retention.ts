const DAY_MS = 86_400_000
const SUCCESSFUL_RUN_RETENTION_DAYS = 30
const FAILED_RUN_RETENTION_DAYS = 90

export function jobRunRetentionCutoffs(now: Date) {
  return {
    successful: new Date(
      now.getTime() - SUCCESSFUL_RUN_RETENTION_DAYS * DAY_MS,
    ),
    failed: new Date(now.getTime() - FAILED_RUN_RETENTION_DAYS * DAY_MS),
  }
}
