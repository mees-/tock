import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { parseJson } from "@/lib/parseJson"
import { isRunStatus } from "@/lib/typeGuards"
import StatusBadge from "./StatusBadge"
import AnimatedNumber from "./AnimatedNumber"
import { usePostHog } from "posthog-js/react"

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
      if (jobId != null) posthog.capture("response_body_copied", { job_id: jobId })
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

export default function RunsTable({ runs, jobId }: { runs: Run[]; jobId?: number }) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (runs.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">No runs yet.</p>
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Triggered at</th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">Status</th>
            <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">HTTP</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {runs.map(run => {
            const isExpanded = expandedId === run.id
            const headers = run.responseHeaders != null ? parseJson<Record<string, string>>(run.responseHeaders) : null

            return (
              <>
                <tr
                  key={run.id}
                  onClick={() => setExpandedId(isExpanded ? null : run.id)}
                  className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {new Date(run.triggeredAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={isRunStatus(run.status) ? run.status : "failure"} />
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                    {run.durationMs != null ? <AnimatedNumber value={`${run.durationMs}ms`} /> : "—"}
                  </td>
                </tr>

                {isExpanded && (
                  <tr key={`${run.id}-detail`} className="bg-zinc-50 dark:bg-zinc-950">
                    <td colSpan={4} className="px-4 py-4">
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
                                <CopyButton text={tryFormatJson(run.responseBody)} jobId={jobId} />
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
                                    <td className="py-1 pr-4 font-mono text-zinc-500 dark:text-zinc-400">{key}</td>
                                    <td className="py-1 font-mono text-zinc-700 dark:text-zinc-300">{value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {run.responseBody == null && run.errorMessage == null && headers == null && (
                          <p className="text-xs text-zinc-400 dark:text-zinc-600">No details available.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
