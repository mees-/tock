export type RunStatus = "success" | "failure" | "timeout"

export type RunFilter =
  | { type: "all" }
  | { type: "status"; statuses: RunStatus[] }
  | { type: "anomaly" }

export function parseRunFilter(search: string): RunFilter {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  )
  const filter = params.get("filter")
  if (filter === "anomaly") return { type: "anomaly" }
  if (filter != null && filter !== "") {
    const statuses = filter.split(",").filter(isRunStatus)
    if (statuses.length > 0) return { type: "status", statuses }
  }
  return { type: "all" }
}

export function serializeRunFilter(filter: RunFilter): URLSearchParams | null {
  if (filter.type === "anomaly") {
    return new URLSearchParams({ filter: "anomaly" })
  }
  if (filter.type !== "all") {
    return new URLSearchParams({ filter: filter.statuses.join(",") })
  }
  return null
}

function isRunStatus(s: string): s is RunStatus {
  return s === "success" || s === "failure" || s === "timeout"
}
