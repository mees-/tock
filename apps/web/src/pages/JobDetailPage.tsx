import { useEffect, useMemo, useReducer, useState } from "react"
import { useParams, useLocation } from "wouter"
import { useQuery, useMutation } from "urql"
import { Trash2, Play, Pause, Pencil, X } from "lucide-react"
import { graphql } from "@/lib/graphql/graphql"
import { smallestCronIntervalMs } from "@/lib/cronInterval"
import { parseJson } from "@/lib/parseJson"
import RunsTable from "@/components/RunsTable"
import { usePostHog } from "posthog-js/react"
import cronstrue from "cronstrue"
import { Cron } from "croner"
import { DateTime } from "luxon"
import { inputCls } from "@/lib/styles"

type Header = { key: string; value: string }

type EditForm = {
  name: string
  description: string
  endpoint: string
  method: string
  cronExpression: string
  timezone: string
  headers: Header[]
  body: string
  showBody: boolean
}

// inputCls includes w-full; strip it for elements that need explicit widths
const selectCls = inputCls.replace("w-full ", "")

const JobDetailQuery = graphql(`
  query JobDetail($id: Int!) {
    job(id: $id) {
      id
      name
      description
      endpoint
      method
      headers
      body
      cronExpression
      timezone
      isActive
      status
      runs(amount: 50) {
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
  }
`)

const ToggleJobMutation = graphql(`
  mutation ToggleJobDetail($id: Int!) {
    toggleJob(id: $id) {
      id
      isActive
    }
  }
`)

const DeleteJobMutation = graphql(`
  mutation DeleteJob($id: Int!) {
    deleteJob(id: $id)
  }
`)

const UpdateJobMutation = graphql(`
  mutation UpdateJobDetail($input: UpdateJobInput!) {
    updateJob(input: $input) {
      id
      name
      description
      endpoint
      method
      headers
      body
      cronExpression
      timezone
    }
  }
`)

export default function JobDetailPage() {
  const params = useParams<{ id: string }>()
  const [, navigate] = useLocation()
  const id = Number(params.id)
  const posthog = usePostHog()

  const [{ data, fetching }, reexecuteQuery] = useQuery({
    query: JobDetailQuery,
    variables: { id },
  })

  const [, toggleJob] = useMutation(ToggleJobMutation)
  const [, deleteJob] = useMutation(DeleteJobMutation)
  const [, updateJob] = useMutation(UpdateJobMutation)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)

  const cronExpression = data?.job?.cronExpression
  const intervalMs =
    cronExpression != null ? smallestCronIntervalMs([cronExpression]) : 60_000

  useEffect(() => {
    const timer = setInterval(() => {
      reexecuteQuery({ requestPolicy: "network-only" })
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, reexecuteQuery])

  if (fetching && data == null) return <p className="text-zinc-500">Loading…</p>
  if (data?.job == null)
    return <p className="text-red-500 dark:text-red-400">Job not found</p>

  const { job } = data
  const runs = job.runs

  async function handleDelete() {
    if (!confirm(`Delete job "${job.name}"? This cannot be undone.`)) return
    const result = await deleteJob({ id })
    if (result.error == null) {
      posthog.capture("job_deleted", { job_id: id })
    }
    navigate("/dashboard")
  }

  function enterEdit() {
    const parsed = JSON.parse(job.headers) as Record<string, string>
    setForm({
      name: job.name,
      description: job.description,
      endpoint: job.endpoint,
      method: job.method,
      cronExpression: job.cronExpression,
      timezone: job.timezone,
      headers: Object.entries(parsed).map(([key, value]) => ({ key, value })),
      body: job.body ?? "",
      showBody: job.body != null,
    })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setForm(null)
    setEditError(null)
  }

  function updateForm<K extends keyof EditForm>(field: K, value: EditForm[K]) {
    setForm(prev => (prev == null ? null : { ...prev, [field]: value }))
  }

  async function handleSave() {
    if (form == null) return
    setSaving(true)
    setEditError(null)
    const headersObj = Object.fromEntries(
      form.headers
        .filter(h => h.key.trim() !== "")
        .map(h => [h.key.trim(), h.value]),
    )
    const result = await updateJob({
      input: {
        id,
        name: form.name,
        description: form.description,
        endpoint: form.endpoint,
        method: form.method,
        headers: JSON.stringify(headersObj),
        body: form.showBody ? form.body || undefined : undefined,
        cronExpression: form.cronExpression,
        timezone: form.timezone,
      },
    })
    setSaving(false)
    if (result.error != null) {
      setEditError(result.error.graphQLErrors[0]?.message ?? "Failed to save")
      return
    }
    reexecuteQuery({ requestPolicy: "network-only" })
    setEditing(false)
    setForm(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {job.name}
          </h1>
          {job.description !== "" && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {job.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const result = await toggleJob({ id })
              if (result.data != null) {
                posthog.capture("job_toggled", {
                  job_id: id,
                  active: result.data.toggleJob.isActive,
                })
              }
              reexecuteQuery({ requestPolicy: "network-only" })
            }}
            className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white"
          >
            {job.isActive ? <Pause size={14} /> : <Play size={14} />}
            {job.isActive ? "Pause" : "Resume"}
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="mb-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-lg">
        {/* Title bar */}
        <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
          <span className="ml-2 flex-1 text-xs text-zinc-500">
            tock — job config
          </span>
          {editing ? (
            <button
              onClick={cancelEdit}
              className="rounded p-1 text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              <X size={14} />
            </button>
          ) : (
            <button
              onClick={enterEdit}
              className="rounded p-1 text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>

        {editing && form != null ? (
          <div className="flex flex-col gap-4 p-6 text-sm">
            <div className="flex gap-6">
              <ConfigRow label="Name" className="flex-1">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => updateForm("name", e.target.value)}
                  required
                  className={inputCls}
                />
              </ConfigRow>
              <ConfigRow label="Description" className="flex-1">
                <input
                  type="text"
                  value={form.description}
                  onChange={e => updateForm("description", e.target.value)}
                  className={inputCls}
                />
              </ConfigRow>
            </div>
            <ConfigRow label="Method & Endpoint">
              <div className="flex min-w-0 gap-2">
                <select
                  value={form.method}
                  onChange={e => updateForm("method", e.target.value)}
                  className={`w-28 shrink-0 ${selectCls}`}
                >
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <input
                  type="url"
                  value={form.endpoint}
                  onChange={e => updateForm("endpoint", e.target.value)}
                  required
                  placeholder="https://example.com/webhook"
                  className={`min-w-0 flex-1 ${inputCls}`}
                />
              </div>
            </ConfigRow>
            <div className="flex gap-6">
              <ConfigRow label="Schedule" className="flex-1">
                <input
                  type="text"
                  value={form.cronExpression}
                  onChange={e => updateForm("cronExpression", e.target.value)}
                  className={`${inputCls} font-mono`}
                />
                <CronDescription expr={form.cronExpression} />
              </ConfigRow>
              <ConfigRow label="Timezone" className="w-40 shrink-0">
                <input
                  type="text"
                  value={form.timezone}
                  onChange={e => updateForm("timezone", e.target.value)}
                  placeholder="UTC"
                  className={inputCls}
                />
              </ConfigRow>
            </div>
            <ConfigRow label="Headers">
              <HeadersEditor
                headers={form.headers}
                onChange={v => updateForm("headers", v)}
              />
            </ConfigRow>
            <BodyField
              value={form.body}
              show={form.showBody}
              onShow={v => updateForm("showBody", v)}
              onChange={v => updateForm("body", v)}
            />
            {editError != null && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {editError}
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={cancelEdit}
                className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 font-mono text-sm leading-relaxed">
            <p>
              <span className="text-zinc-500">method: </span>
              <span className={methodColor(job.method)}>{job.method}</span>
            </p>
            <p>
              <span className="text-zinc-500">endpoint: </span>
              <span className="text-blue-400">{job.endpoint}</span>
            </p>
            <p>
              <span className="text-zinc-500">schedule: </span>
              <span className="text-white">{job.cronExpression}</span>
              <CronComment expr={job.cronExpression} />
            </p>
            {runs.length > 0 && (
              <p className="mt-3 flex items-center gap-2 text-zinc-400">
                {runs[0].httpStatusCode != null &&
                runs[0].httpStatusCode >= 200 &&
                runs[0].httpStatusCode < 300 ? (
                  <span className="text-emerald-400">✓</span>
                ) : (
                  <span className="text-red-400">✗</span>
                )}
                <span>
                  Last run{" "}
                  <span
                    className={
                      runs[0].httpStatusCode != null &&
                      runs[0].httpStatusCode >= 200 &&
                      runs[0].httpStatusCode < 300
                        ? "text-white"
                        : "text-red-400"
                    }
                  >
                    {runs[0].httpStatusCode ?? runs[0].status}
                  </span>{" "}
                  {runs[0].durationMs != null && (
                    <>
                      in{" "}
                      <span className="text-white">{runs[0].durationMs}ms</span>
                    </>
                  )}
                </span>
                <span className="animate-pulse text-zinc-600">▌</span>
                {!job.isActive && (
                  <span className="ml-4 text-zinc-600">paused</span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Run history */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Run history
        </h2>
        <RunsTable runs={runs} jobId={id} />
      </div>
    </div>
  )
}

function ConfigRow({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <dt className="mb-1 text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="text-zinc-800 dark:text-zinc-200">{children}</dd>
    </div>
  )
}

const nestedInputCls =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-600"

const COMMON_HEADERS = [
  "Accept",
  "Authorization",
  "Cache-Control",
  "Content-Type",
  "Idempotency-Key",
  "User-Agent",
  "X-API-Key",
  "X-Forwarded-For",
  "X-Request-ID",
]

function HeadersEditor({
  headers,
  onChange,
}: {
  headers: Header[]
  onChange: (headers: Header[]) => void
}) {
  function addRow() {
    onChange([...headers, { key: "", value: "" }])
  }

  function removeRow(index: number) {
    onChange(headers.filter((_, i) => i !== index))
  }

  function updateRow(index: number, field: "key" | "value", value: string) {
    onChange(
      headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    )
  }

  return (
    <div className="rounded-lg border border-zinc-300 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <datalist id="header-names-edit">
        {COMMON_HEADERS.map(h => (
          <option key={h} value={h} />
        ))}
      </datalist>

      {headers.length > 0 ? (
        <div className="mb-2 space-y-1.5">
          {headers.map((header, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                list="header-names-edit"
                value={header.key}
                onChange={e => updateRow(i, "key", e.target.value)}
                placeholder="Name"
                className={`w-44 ${nestedInputCls}`}
              />
              <span className="text-zinc-400 dark:text-zinc-600">:</span>
              <input
                type="text"
                value={header.value}
                onChange={e => updateRow(i, "value", e.target.value)}
                placeholder="Value"
                className={`min-w-0 flex-1 ${nestedInputCls}`}
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remove header"
                className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-red-600 dark:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 2l10 10M12 2L2 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-600">
          No headers configured.
        </p>
      )}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-500 dark:hover:text-emerald-400"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 1v10M1 6h10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Add header
      </button>
    </div>
  )
}

function BodyField({
  value,
  show,
  onShow,
  onChange,
}: {
  value: string
  show: boolean
  onShow: (v: boolean) => void
  onChange: (v: string) => void
}) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium text-zinc-500">Body</dt>
      <dd>
        {show ? (
          <div className="space-y-2">
            <textarea
              value={value}
              onChange={e => onChange(e.target.value)}
              rows={4}
              placeholder='{"key": "value"}'
              className={`${inputCls} font-mono`}
            />
            <button
              type="button"
              onClick={() => {
                onShow(false)
                onChange("")
              }}
              className="flex items-center gap-1.5 text-xs text-red-500 transition-colors hover:text-red-400 dark:text-red-400 dark:hover:text-red-300"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 2l8 8M10 2L2 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Remove body
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onShow(true)}
            className="flex items-center gap-1.5 text-xs text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-500 dark:hover:text-emerald-400"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1v10M1 6h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Add body
          </button>
        )}
      </dd>
    </div>
  )
}

function methodColor(method: string) {
  if (method === "GET") return "text-emerald-400"
  if (method === "DELETE") return "text-red-400"
  return "text-blue-400"
}

function CronComment({ expr }: { expr: string }) {
  try {
    const description = cronstrue.toString(expr.trim(), { verbose: false })
    return <span className="text-zinc-600"> # {description.toLowerCase()}</span>
  } catch {
    return null
  }
}

function CronDescription({ expr }: { expr: string }) {
  const [tick, reload] = useReducer(n => n + 1, 0)

  const description = useMemo(() => {
    try {
      return cronstrue.toString(expr.trim())
    } catch {
      return null
    }
  }, [expr])

  const nextRun = useMemo(() => {
    try {
      const job = new Cron(expr.trim(), { paused: true }, () => {})
      const next = job.nextRun()
      if (next == null) return null
      const dt = DateTime.fromJSDate(next)
      return dt.isValid ? dt : null
    } catch {
      return null
    }
  }, [expr, tick])

  useEffect(() => {
    if (nextRun == null) return
    const ms = nextRun.diffNow().toMillis()
    const t = setTimeout(reload, ms)
    return () => clearTimeout(t)
  }, [nextRun])

  return (
    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-600">
      {description != null ? (
        <>
          {description}
          {nextRun != null && (
            <>
              {" "}
              · Next:{" "}
              {nextRun.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}
            </>
          )}
        </>
      ) : (
        <span className="text-red-500 dark:text-red-400">
          Invalid cron expression
        </span>
      )}
    </p>
  )
}
