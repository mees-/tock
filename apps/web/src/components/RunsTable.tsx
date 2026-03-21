import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useQuery } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import { client } from "@/lib/graphql/client"
import { Check, Copy, Loader2 } from "lucide-react"
import { parseJson } from "@/lib/parseJson"
import { isRunStatus } from "@/lib/typeGuards"
import StatusBadge from "./StatusBadge"
import AnimatedNumber from "./AnimatedNumber"
import { usePostHog } from "posthog-js/react"

const PAGE_SIZE = 50

const JobRunsQuery = graphql(`
  query JobRuns($jobId: Int!, $first: Int!, $after: String) {
    job(id: $jobId) {
      runs(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            triggeredAt
            status
            httpStatusCode
            durationMs
            responseBody
            responseHeaders
            errorMessage
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`)

interface Run {
  id: number
  triggeredAt: string
  status: string
  httpStatusCode?: number | null
  durationMs?: number | null
  responseBody?: string | null
  responseHeaders?: string | null
  errorMessage?: string | null
}

function tryFormatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function CopyButton({ text, jobId }: { text: string; jobId?: number }) {
  const [copied, setCopied] = useState(false)
  const posthog = usePostHog()

  function handleCopy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      if (jobId != null)
        posthog.capture("response_body_copied", { job_id: jobId })
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="cursor-pointer rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

const ROW_HEIGHT = 45

function RunRow({
  run,
  jobId,
  isExpanded,
  onToggle,
}: {
  run: Run
  jobId: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const headers =
    run.responseHeaders != null
      ? parseJson<Record<string, string>>(run.responseHeaders)
      : null

  return (
    <Fragment>
      <div
        onClick={onToggle}
        className="grid cursor-pointer grid-cols-[1fr_100px_80px_100px] items-center border-b border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
        style={{ height: ROW_HEIGHT }}
      >
        <div className="px-4 text-sm text-zinc-700 dark:text-zinc-300">
          {new Date(run.triggeredAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
        <div className="px-4">
          <StatusBadge
            status={isRunStatus(run.status) ? run.status : "failure"}
          />
        </div>
        <div className="px-4 text-sm">
          {run.httpStatusCode != null ? (
            <AnimatedNumber
              value={run.httpStatusCode}
              className={
                run.httpStatusCode < 400
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-500 dark:text-red-400"
              }
            />
          ) : (
            <span className="text-zinc-400 dark:text-zinc-600">—</span>
          )}
        </div>
        <div className="px-4 text-right text-sm text-zinc-700 dark:text-zinc-300">
          {run.durationMs != null ? (
            <AnimatedNumber value={`${run.durationMs}ms`} />
          ) : (
            "—"
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="space-y-4">
            {run.errorMessage != null && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-red-500 dark:text-red-400">
                  Error
                </p>
                <pre className="overflow-auto rounded bg-red-50 p-3 text-xs text-red-700 dark:bg-zinc-900 dark:text-red-300">
                  {run.errorMessage}
                </pre>
              </div>
            )}

            {run.responseBody != null && run.responseBody !== "" && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Response body
                </p>
                <div className="relative">
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {tryFormatJson(run.responseBody)}
                  </pre>
                  <div className="absolute right-2 top-2">
                    <CopyButton
                      text={tryFormatJson(run.responseBody)}
                      jobId={jobId}
                    />
                  </div>
                </div>
              </div>
            )}

            {headers != null && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Response headers
                </p>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {Object.entries(headers).map(([key, value]) => (
                      <tr key={key}>
                        <td className="py-1 pr-4 font-mono text-zinc-500 dark:text-zinc-400">
                          {key}
                        </td>
                        <td className="py-1 font-mono text-zinc-700 dark:text-zinc-300">
                          {value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {run.responseBody == null &&
              run.errorMessage == null &&
              headers == null && (
                <p className="text-xs text-zinc-400 dark:text-zinc-600">
                  No details available.
                </p>
              )}
          </div>
        </div>
      )}
    </Fragment>
  )
}

export default function RunsTable({
  jobId,
  pollIntervalMs,
}: {
  jobId: number
  pollIntervalMs?: number
}) {
  const [allRuns, setAllRuns] = useState<Run[]>([])
  const [endCursor, setEndCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  // Initial page fetch
  const [{ data, fetching }, reexecuteQuery] = useQuery({
    query: JobRunsQuery,
    variables: { jobId, first: PAGE_SIZE },
    requestPolicy: "cache-and-network",
  })

  // Sync initial data
  useEffect(() => {
    if (data?.job == null) return
    const connection = data.job.runs
    const runs = connection.edges.map(e => e.node)
    setAllRuns(prev => {
      // Merge: keep any older pages already loaded beyond the first page
      const firstPageIds = new Set(runs.map(r => r.id))
      const olderRuns = prev.filter(r => !firstPageIds.has(r.id))
      // Only keep older runs that come after the first page (lower ids)
      const lastFirstPageId =
        runs.length > 0 ? runs[runs.length - 1]!.id : Infinity
      const beyondFirstPage = olderRuns.filter(r => r.id < lastFirstPageId)
      return [...runs, ...beyondFirstPage]
    })
    setEndCursor(connection.pageInfo.endCursor ?? null)
    setHasNextPage(connection.pageInfo.hasNextPage)
  }, [data])

  useEffect(() => {
    if (pollIntervalMs == null || pollIntervalMs <= 0) return
    const timer = setInterval(() => {
      reexecuteQuery({ requestPolicy: "network-only" })
    }, pollIntervalMs)
    return () => clearInterval(timer)
  }, [pollIntervalMs, reexecuteQuery])

  const loadMore = useCallback(async () => {
    if (!hasNextPage || isLoadingMore || endCursor == null) return
    setIsLoadingMore(true)
    try {
      // Use cache-first for older pages since committed runs are immutable
      const result = await client
        .query(
          JobRunsQuery,
          {
            jobId,
            first: PAGE_SIZE,
            after: endCursor,
          },
          {
            requestPolicy: "cache-first",
          },
        )
        .toPromise()
      const connection = result.data?.job?.runs
      if (connection == null) return
      const newRuns = connection.edges.map(e => e.node)
      setAllRuns(prev => [...prev, ...newRuns])
      setEndCursor(connection.pageInfo.endCursor ?? null)
      setHasNextPage(connection.pageInfo.hasNextPage)
    } finally {
      setIsLoadingMore(false)
    }
  }, [jobId, endCursor, hasNextPage, isLoadingMore])

  const virtualizer = useVirtualizer({
    count: allRuns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  // Load more when scrolling near bottom
  const virtualItems = virtualizer.getVirtualItems()
  const lastItem = virtualItems[virtualItems.length - 1]
  useEffect(() => {
    if (
      lastItem != null &&
      lastItem.index >= allRuns.length - 10 &&
      hasNextPage &&
      !isLoadingMore
    ) {
      void loadMore()
    }
  }, [lastItem?.index, allRuns.length, hasNextPage, isLoadingMore, loadMore])

  if (fetching && allRuns.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">Loading runs…</p>
    )
  }

  if (allRuns.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">No runs yet.</p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="grid grid-cols-[1fr_100px_80px_100px] border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Triggered at
        </div>
        <div className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Status
        </div>
        <div className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
          HTTP
        </div>
        <div className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Duration
        </div>
      </div>

      {/* Virtualized list */}
      <div ref={parentRef} className="max-h-150 overflow-auto">
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
            width: "100%",
          }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const run = allRuns[virtualRow.index]!
            return (
              <div
                key={run.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <RunRow
                  run={run}
                  jobId={jobId}
                  isExpanded={expandedId === run.id}
                  onToggle={() =>
                    setExpandedId(prev => (prev === run.id ? null : run.id))
                  }
                />
              </div>
            )
          })}
        </div>

        {isLoadingMore && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            <span className="ml-2 text-sm text-zinc-400">Loading more…</span>
          </div>
        )}
      </div>
    </div>
  )
}
