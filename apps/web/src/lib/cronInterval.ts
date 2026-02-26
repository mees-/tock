const MS_PER_SECOND = 1_000
const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000
const MS_PER_MONTH = 2_592_000_000

// 6-field cron format: sec min hour day month weekday
// Unit in ms for each positional field (weekday skipped — it's a filter, not a frequency)
const FIELD_UNITS_MS = [MS_PER_SECOND, MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY, MS_PER_MONTH]

const MIN_INTERVAL_MS = 10 * MS_PER_SECOND // floor: 10 seconds
const MAX_INTERVAL_MS = MS_PER_HOUR // ceiling: 1 hour (for very infrequent jobs)

function fieldIntervalMs(field: string, unitMs: number): number {
  if (field === "*") return unitMs

  if (field.startsWith("*/")) {
    const n = parseInt(field.slice(2), 10)
    if (!isNaN(n) && n > 0) return n * unitMs
  }

  if (field.includes(",")) {
    const values = field
      .split(",")
      .map(Number)
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b)
    if (values.length >= 2) {
      let minGap = Infinity
      for (let i = 1; i < values.length; i++) {
        minGap = Math.min(minGap, values[i] - values[i - 1])
      }
      return minGap * unitMs
    }
  }

  return Infinity // specific single value — doesn't cycle at this level
}

/** Returns the approximate repeat interval of a 6-field cron expression in ms. */
export function cronIntervalMs(expr: string): number {
  const fields = expr.trim().split(/\s+/)
  if (fields.length !== 6) return MS_PER_MINUTE

  let smallest = Infinity
  for (let i = 0; i < 5; i++) {
    smallest = Math.min(smallest, fieldIntervalMs(fields[i], FIELD_UNITS_MS[i]))
  }

  return smallest === Infinity ? MS_PER_DAY : smallest
}

/**
 * Given a list of cron expressions, returns the polling interval to use:
 * the smallest interval clamped between MIN_INTERVAL_MS and MAX_INTERVAL_MS.
 * Falls back to 60 s when the list is empty.
 */
export function smallestCronIntervalMs(exprs: string[]): number {
  if (exprs.length === 0) return MS_PER_MINUTE
  const smallest = Math.min(...exprs.map(cronIntervalMs))
  return Math.max(Math.min(smallest, MAX_INTERVAL_MS), MIN_INTERVAL_MS)
}
