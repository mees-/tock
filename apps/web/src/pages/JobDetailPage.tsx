import { useEffect, useState } from "react"
import { useParams, useLocation } from "wouter"
import { useQuery, useMutation } from "urql"
import { Trash2, Play, Pause, Pencil, X } from "lucide-react"
import { graphql } from "@/lib/graphql/graphql"
import { smallestCronIntervalMs } from "@/lib/cronInterval"
import RunsTable from "@/components/RunsTable"
import { usePostHog } from "posthog-js/react"
import cronstrue from "cronstrue"

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

const termInputCls =
  "bg-transparent border-none outline-none font-mono text-sm caret-emerald-400 selection:bg-emerald-900/40 w-full"

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]

function isValidUrl(s: string) {
  try {
    new URL(s)
    return true
  } catch {
    return false
  }
}

function isValidCron(s: string) {
  try {
    cronstrue.toString(s.trim())
    return true
  } catch {
    return false
  }
}

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
        <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-3">
          {/*SOME ICON HERE*/}
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
          <div className="px-5 py-4 font-mono text-sm leading-relaxed space-y-1">
            {/* name */}
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-zinc-500">name:</span>
              <input
                type="text"
                value={form.name}
                onChange={e => updateForm("name", e.target.value)}
                className={`${termInputCls} text-white ${!form.name.trim() ? "underline decoration-wavy decoration-red-500" : ""}`}
              />
            </div>
            {/* desc */}
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-zinc-500">desc:</span>
              <input
                type="text"
                value={form.description}
                onChange={e => updateForm("description", e.target.value)}
                className={`${termInputCls} text-zinc-400`}
              />
            </div>
            {/* method */}
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-zinc-500">method:</span>
              <input
                type="text"
                list="http-methods"
                value={form.method}
                onChange={e =>
                  updateForm("method", e.target.value.toUpperCase())
                }
                className={`${termInputCls} ${methodColor(form.method)} w-28`}
              />
              <datalist id="http-methods">
                {METHODS.map(m => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            {/* endpoint */}
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-zinc-500">endpoint: </span>
              <input
                type="text"
                value={form.endpoint}
                onChange={e => updateForm("endpoint", e.target.value)}
                className={`${termInputCls} text-blue-400 ${!isValidUrl(form.endpoint) ? "underline decoration-wavy decoration-red-500" : ""}`}
              />
            </div>
            {/* schedule */}
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-zinc-500">schedule: </span>
              <input
                type="text"
                value={form.cronExpression}
                onChange={e => updateForm("cronExpression", e.target.value)}
                style={{
                  width: `${Math.max(form.cronExpression.length, 1)}ch`,
                }}
                className={`${termInputCls} text-white w-auto ${!isValidCron(form.cronExpression) ? "underline decoration-wavy decoration-red-500" : ""}`}
              />
              <CronComment expr={form.cronExpression} />
            </div>

            {/* Headers sub-card */}
            <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/30 px-4 py-3 mt-4">
              <p className="text-xs text-zinc-600 font-mono mb-2"># headers</p>
              <HeadersEditor
                headers={form.headers}
                onChange={v => updateForm("headers", v)}
              />
            </div>

            {/* Body sub-card or add link */}
            <BodyField
              value={form.body}
              show={form.showBody}
              onShow={v => updateForm("showBody", v)}
              onChange={v => updateForm("body", v)}
            />

            {editError != null && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400 mt-3">
                {editError}
              </div>
            )}
            <div className="flex gap-3 pt-3">
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
    <div>
      <datalist id="header-names-edit">
        {COMMON_HEADERS.map(h => (
          <option key={h} value={h} />
        ))}
      </datalist>

      {headers.length > 0 && (
        <div className="mb-2 space-y-1">
          {headers.map((header, i) => (
            <div key={i} className="flex items-baseline gap-0">
              <input
                type="text"
                list="header-names-edit"
                value={header.key}
                onChange={e => updateRow(i, "key", e.target.value)}
                placeholder="Header-Name"
                className={`${termInputCls} text-zinc-300 w-44 shrink-0`}
              />
              <span className="shrink-0 text-zinc-500">: </span>
              <input
                type="text"
                value={header.value}
                onChange={e => updateRow(i, "value", e.target.value)}
                placeholder="value"
                className={`${termInputCls} text-zinc-200 flex-1`}
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                aria-label="Remove header"
                className="shrink-0 ml-2 text-zinc-600 transition-colors hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="text-xs text-emerald-500 transition-colors hover:text-emerald-400"
      >
        + add header
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
  if (show) {
    return (
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/30 px-4 py-3 mt-4">
        <p className="text-xs text-zinc-600 font-mono mb-2"># body</p>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={4}
          placeholder='{"key": "value"}'
          className={`${termInputCls} text-zinc-300 resize-none`}
        />
        <button
          type="button"
          onClick={() => {
            onShow(false)
            onChange("")
          }}
          className="mt-1 text-xs text-red-400 transition-colors hover:text-red-300"
        >
          − remove body
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => onShow(true)}
        className="text-xs text-emerald-500 transition-colors hover:text-emerald-400"
      >
        + add body
      </button>
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
    return (
      <span className="text-zinc-600 ml-4"># {description.toLowerCase()}</span>
    )
  } catch {
    return null
  }
}
