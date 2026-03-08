import { useEffect, useMemo, useReducer, useState } from "react"
import cronstrue from "cronstrue"
import { Cron } from "croner"
import { DateTime } from "luxon"
import { Pencil, X, Pause, Play, Trash2 } from "lucide-react"
import { HeadersEditor } from "./HeadersEditor"
import { BodyField } from "./BodyField"
import type { Header } from "./HeadersEditor"

export type { Header }

export type JobFormValues = {
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

export const NEW_JOB_DEFAULTS: JobFormValues = {
  name: "",
  description: "",
  endpoint: "",
  method: "GET",
  cronExpression: "0 * * * *",
  timezone: "UTC",
  headers: [],
  body: "",
  showBody: false,
}

export function serializeHeaders(headers: Header[]) {
  return JSON.stringify(
    Object.fromEntries(
      headers
        .filter(h => h.key.trim() !== "")
        .map(h => [h.key.trim(), h.value]),
    ),
  )
}

type JobFormProps =
  | {
      mode: "new"
      initialValues?: Partial<JobFormValues>
      onSubmit: (values: JobFormValues) => Promise<void>
    }
  | {
      mode: "edit"
      isActive: boolean
      initialValues: JobFormValues
      onSubmit: (values: JobFormValues) => Promise<void>
      onToggle: () => Promise<void>
      onDelete: () => Promise<void>
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

function methodColor(method: string) {
  if (method === "GET") return "text-emerald-400"
  if (method === "DELETE") return "text-red-400"
  return "text-blue-400"
}

function CronComment({ expr }: { expr: string }) {
  // Next run calculation
  const expressionNormalized = expr.trim()
  const [, reloadNextRun] = useReducer((n: number) => n + 1, 0)

  const nextRunDate = useMemo(() => {
    try {
      const job = new Cron(expressionNormalized, { paused: true }, () => {})
      const nextRun = job.nextRun()
      if (nextRun == null) return null
      const date = DateTime.fromJSDate(nextRun)
      return date.isValid ? date : null
    } catch {
      return null
    }
  }, [expressionNormalized])

  const cronIsValid = nextRunDate != null

  useEffect(() => {
    if (nextRunDate == null) return
    const waitTime = nextRunDate.diffNow().toMillis()
    const timer = setTimeout(reloadNextRun, waitTime)
    return () => clearTimeout(timer)
  }, [nextRunDate])

  const nextRunFormatted = useMemo(() => {
    if (nextRunDate == null) return null
    return nextRunDate.toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)
  }, [nextRunDate])

  if (!cronIsValid) {
    return null
  }

  try {
    const description = cronstrue.toString(expr.trim(), { verbose: false })
    return (
      <div className="text-zinc-600 flex flex-wrap">
        <span className="mr-2"># {description.toLowerCase()}</span>
        <span>
          {nextRunFormatted != null && (
            <>
              -{">"} next: {nextRunFormatted}
            </>
          )}
        </span>
      </div>
    )
  } catch {
    return null
  }
}

export function JobForm(props: JobFormProps) {
  const isNew = props.mode === "new"
  const [editing, setEditing] = useState(isNew)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<JobFormValues>({
    ...NEW_JOB_DEFAULTS,
    ...(props.initialValues ?? {}),
  })

  function updateForm<K extends keyof JobFormValues>(
    field: K,
    value: JobFormValues[K],
  ) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function enterEdit() {
    if (props.mode === "edit") {
      setForm({ ...NEW_JOB_DEFAULTS, ...props.initialValues })
    }
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setError(null)
  }

  async function handleSubmit() {
    if (!form.name.trim()) return
    if (!isValidUrl(form.endpoint)) return
    if (!isValidCron(form.cronExpression)) return

    setSubmitting(true)
    setError(null)
    try {
      await props.onSubmit(form)
      if (props.mode === "edit") {
        setEditing(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-lg">
      {/* Title bar */}
      <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-3">
        <span className="ml-2 flex-1 text-xs text-zinc-500">
          tock — job config
        </span>

        {props.mode === "edit" && !editing && (
          <div className="flex items-center gap-1">
            <button
              onClick={props.onToggle}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              {props.isActive ? <Pause size={12} /> : <Play size={12} />}
              {props.isActive ? "Pause" : "Resume"}
            </button>
            <button
              onClick={props.onDelete}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-red-500 transition-colors hover:text-red-400"
            >
              <Trash2 size={12} />
              Delete
            </button>
            <button
              onClick={enterEdit}
              className="rounded p-1 text-zinc-400 transition-colors hover:text-zinc-300"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}

        {props.mode === "edit" && editing && (
          <button
            onClick={cancelEdit}
            className="rounded p-1 text-zinc-400 transition-colors hover:text-zinc-300"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="px-5 py-4 font-mono text-sm leading-relaxed space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-zinc-500">name:</span>
            <input
              type="text"
              value={form.name}
              onChange={e => updateForm("name", e.target.value)}
              className={`${termInputCls} text-white ${!form.name.trim() ? "underline decoration-wavy decoration-red-500" : ""}`}
            />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-zinc-500">desc:</span>
            <input
              type="text"
              value={form.description}
              onChange={e => updateForm("description", e.target.value)}
              className={`${termInputCls} text-zinc-400`}
            />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-zinc-500">method:</span>
            <input
              type="text"
              list="http-methods-form"
              value={form.method}
              onChange={e => updateForm("method", e.target.value.toUpperCase())}
              className={`${termInputCls} ${methodColor(form.method)} w-28`}
            />
            <datalist id="http-methods-form">
              {METHODS.map(m => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-zinc-500">endpoint:</span>
            <input
              type="text"
              value={form.endpoint}
              onChange={e => updateForm("endpoint", e.target.value)}
              className={`${termInputCls} text-blue-400 ${!isValidUrl(form.endpoint) ? "underline decoration-wavy decoration-red-500" : ""}`}
            />
          </div>

          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="shrink-0 text-zinc-500">schedule:</span>
            <input
              type="text"
              value={form.cronExpression}
              onChange={e => updateForm("cronExpression", e.target.value)}
              style={{
                width: `${Math.max(form.cronExpression.length, 1)}ch`,
              }}
              className={`${termInputCls} text-white w-auto ${!isValidCron(form.cronExpression) ? "underline decoration-wavy decoration-red-500" : ""} mr-4`}
            />
            <CronComment expr={form.cronExpression} />
          </div>

          <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/30 px-4 py-3 mt-4">
            <p className="text-xs text-zinc-600 font-mono mb-2"># headers</p>
            <HeadersEditor
              headers={form.headers}
              onChange={v => updateForm("headers", v)}
            />
          </div>

          <BodyField
            value={form.body}
            show={form.showBody}
            onShow={v => updateForm("showBody", v)}
            onChange={v => updateForm("body", v)}
          />

          {error != null && (
            <div className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400 mt-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting
                ? isNew
                  ? "Creating…"
                  : "Saving…"
                : isNew
                  ? "Create job"
                  : "Save changes"}
            </button>
            {props.mode === "edit" && (
              <button
                onClick={cancelEdit}
                className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Read-only view (edit mode, not editing) */}
      {props.mode === "edit" && !editing && (
        <div className="px-5 py-4 font-mono text-sm leading-relaxed">
          <p>
            <span className="text-zinc-500">method: </span>
            <span className={methodColor(props.initialValues.method)}>
              {props.initialValues.method}
            </span>
          </p>
          <p>
            <span className="text-zinc-500">endpoint: </span>
            <span className="text-blue-400">
              {props.initialValues.endpoint}
            </span>
          </p>
          <p>
            <span className="text-zinc-500">schedule: </span>
            <span className="text-white">
              {props.initialValues.cronExpression}
            </span>
            <CronComment expr={props.initialValues.cronExpression} />
          </p>
          {!props.isActive && <p className="mt-3 text-zinc-600">paused</p>}
        </div>
      )}
    </div>
  )
}
