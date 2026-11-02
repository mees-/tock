import { env } from "./env"

type Fields = Record<string, unknown>
type Level = "debug" | "info" | "warn" | "error"

const LEVEL_ORDER: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}
const MIN_LEVEL: Level = env.NODE_ENV === "production" ? "info" : "debug"

function serialize(value: unknown) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  return value
}

// Workers Logs indexes the keys of objects passed to console.
function log(level: Level, message: string, fields: Fields = {}) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return
  const entry: Fields = { message }
  for (const [key, value] of Object.entries(fields)) {
    entry[key] = serialize(value)
  }
  console[level](entry)
}

export const logger = {
  debug: (message: string, fields?: Fields) => log("debug", message, fields),
  info: (message: string, fields?: Fields) => log("info", message, fields),
  warn: (message: string, fields?: Fields) => log("warn", message, fields),
  error: (message: string, fields?: Fields) => log("error", message, fields),
}
