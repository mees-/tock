import { Cron } from "croner"

export const MINUTE_MS = 60_000

// The Cloudflare Cron Trigger fires once per minute, so seconds fields can't be honoured.
const CRON_FIELD_COUNT = 5

function parseCron(expression: string) {
  return new Cron(expression, { paused: true })
}

export function isValidCronExpression(expression: string) {
  const trimmed = expression.trim()
  if (trimmed.split(/\s+/).length !== CRON_FIELD_COUNT) return false
  try {
    parseCron(trimmed)
    return true
  } catch {
    return false
  }
}

export function firesWithinMinute(expression: string, minuteStart: Date) {
  try {
    const justBefore = new Date(minuteStart.getTime() - 1)
    const next = parseCron(expression).nextRun(justBefore)
    return next != null && next.getTime() < minuteStart.getTime() + MINUTE_MS
  } catch {
    return false
  }
}
