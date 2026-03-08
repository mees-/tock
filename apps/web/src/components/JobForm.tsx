import { useEffect, useMemo, useReducer, useState } from "react"
import clsx from "clsx"
import cronstrue from "cronstrue"
import { Cron } from "croner"
import { DateTime } from "luxon"
import { Pause, Play, Trash2, ChevronRight } from "lucide-react"
import { termInputCls } from "@/lib/styles"
import { HeadersEditor } from "./HeadersEditor"
import type { Header } from "./HeadersEditor"
import { useMediaQuery } from "usehooks-ts"
import { useHotkeys } from "react-hotkeys-hook"

export type { Header }

export type JobFormValues = {
  name: string
  description: string
  endpoint: string
  method: string
  cronExpression: string
  timezone: string
  headers: Header[]
  body: string | null
}

export const NEW_JOB_DEFAULTS: JobFormValues = {
  name: "",
  description: "",
  endpoint: "",
  method: "GET",
  cronExpression: "0 * * * *",
  timezone: "UTC",
  headers: [],
  body: null,
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

type JobFormProps = {
  jobId?: number
  isActive?: boolean
  initialValues?: Partial<JobFormValues>
  onSubmit: (values: JobFormValues) => Promise<void>
  onToggle?: () => Promise<void>
  onDelete?: () => Promise<void>
}

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
  if (method === "GET") return "text-emerald-600 dark:text-emerald-400"
  if (method === "DELETE") return "text-red-500 dark:text-red-400"
  return "text-blue-600 dark:text-blue-400"
}

function CronComment({ expr }: { expr: string }) {
  const expressionNormalized = expr.trim()
  const [tick, reloadNextRun] = useReducer((n: number) => n + 1, 0)

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
  }, [expressionNormalized, tick])

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

  if (nextRunDate == null) return null

  try {
    const description = cronstrue.toString(expressionNormalized, {
      verbose: false,
    })
    return (
      <span className="text-zinc-600">
        # {description.toLowerCase()}
        {nextRunFormatted != null && <> → next: {nextRunFormatted}</>}
      </span>
    )
  } catch {
    return null
  }
}

function UnsavedChangesIndicator({
  handleSubmit,
  submitting,
  isNew,
}: {
  handleSubmit: () => void
  submitting: boolean
  isNew: boolean
}) {
  const isTouchScreen = useMediaQuery("(hover: none)")
  useHotkeys(`mod-Enter`, handleSubmit)
  const isMacOs = globalThis.navigator.platform.startsWith("Mac")
  const saveText = isTouchScreen
    ? "Save"
    : isMacOs
      ? "⌘ - Enter to save"
      : "Ctrl - Enter to save"
  return (
    <>
      <span className="text-xs transition-colors text-zinc-400 cursor-default dark:text-zinc-600">
        Unsaved changes
      </span>
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className={clsx(
          "ml-1 text-xs transition-colors disabled:opacity-50 cursor-pointer",
          !isTouchScreen &&
            "text-zinc-400 hover:text-zinc-700 cursor-default dark:text-zinc-600 dark:hover:text-zinc-300",
          isTouchScreen &&
            "px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-700 cursor-default text-zinc-600 hover:text-zinc-300",
        )}
      >
        {submitting
          ? isNew
            ? "Creating…"
            : "Saving…"
          : isNew
            ? "Create job"
            : saveText}
      </button>
    </>
  )
}

export function JobForm(props: JobFormProps) {
  const isNew = props.jobId == null
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<JobFormValues>({
    ...NEW_JOB_DEFAULTS,
    ...(props.initialValues ?? {}),
  })

  const [baseline, setBaseline] = useState<JobFormValues>(() => ({
    ...NEW_JOB_DEFAULTS,
    ...(props.initialValues ?? {}),
  }))

  const hasChanges = useMemo(() => {
    return (
      form.name !== baseline.name ||
      form.description !== baseline.description ||
      form.endpoint !== baseline.endpoint ||
      form.method !== baseline.method ||
      form.cronExpression !== baseline.cronExpression ||
      form.timezone !== baseline.timezone ||
      form.body !== baseline.body ||
      JSON.stringify(form.headers) !== JSON.stringify(baseline.headers)
    )
  }, [form, baseline])

  const [headersExpanded, setHeadersExpanded] = useState(
    () => (props.initialValues?.headers ?? []).length > 0,
  )
  const [bodyExpanded, setBodyExpanded] = useState(
    () => props.initialValues?.body != null,
  )

  function updateForm<K extends keyof JobFormValues>(
    field: K,
    value: JobFormValues[K],
  ) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (!form.name.trim()) return
    if (!isValidUrl(form.endpoint)) return
    if (!isValidCron(form.cronExpression)) return

    setSubmitting(true)
    setError(null)
    try {
      await props.onSubmit(form)
      setBaseline(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        if (!submitting && hasChanges) handleSubmit()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hasChanges, submitting, form])

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      {/* Title bar */}
      <div className="flex items-center gap-2.5 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="ml-2 flex-1 text-xs text-zinc-500">Job config</span>

        <div className="flex items-center gap-1">
          {hasChanges && (
            <UnsavedChangesIndicator
              handleSubmit={() => !submitting && handleSubmit()}
              submitting={submitting}
              isNew={isNew}
            />
          )}
          {props.onToggle != null && (
            <button
              onClick={props.onToggle}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {props.isActive ? <Pause size={12} /> : <Play size={12} />}
              {props.isActive ? "Pause" : "Resume"}
            </button>
          )}
          {props.onDelete != null && (
            <button
              onClick={props.onDelete}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-red-500 transition-colors hover:text-red-400"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 font-mono text-sm leading-relaxed space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-zinc-500">name:</span>
          <input
            type="text"
            value={form.name}
            onChange={e => updateForm("name", e.target.value)}
            className={clsx(
              termInputCls,
              "text-zinc-900 dark:text-white",
              !form.name.trim() &&
                hasChanges &&
                "underline decoration-wavy decoration-red-500",
            )}
          />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-zinc-500">desc:</span>
          <input
            type="text"
            value={form.description}
            onChange={e => updateForm("description", e.target.value)}
            className={clsx(termInputCls, "text-zinc-600 dark:text-zinc-400")}
          />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-zinc-500">method:</span>
          <input
            type="text"
            list="http-methods-form"
            value={form.method}
            onChange={e => updateForm("method", e.target.value.toUpperCase())}
            className={clsx(termInputCls, methodColor(form.method), "w-28")}
          />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-zinc-500">endpoint:</span>
          <input
            type="text"
            value={form.endpoint}
            onChange={e => updateForm("endpoint", e.target.value)}
            className={clsx(
              termInputCls,
              "text-blue-600 dark:text-blue-400",
              hasChanges &&
                !isValidUrl(form.endpoint) &&
                "underline decoration-wavy decoration-red-500",
            )}
          />
        </div>

        <div className="flex items-baseline gap-2 flex-wrap gap-y-1">
          <span className="shrink-0 text-zinc-500">schedule:</span>
          <input
            type="text"
            value={form.cronExpression}
            onChange={e => updateForm("cronExpression", e.target.value)}
            style={{ width: `${Math.max(form.cronExpression.length, 1)}ch` }}
            className={clsx(
              termInputCls,
              "text-zinc-900 dark:text-white w-auto mr-4",
              {
                "line-through text-zinc-400":
                  props.jobId != null && props.isActive === false,
                "underline decoration-wavy decoration-red-500":
                  hasChanges && !isValidCron(form.cronExpression),
              },
            )}
          />
          {props.isActive ? (
            <CronComment expr={form.cronExpression} />
          ) : (
            <span className="text-zinc-600"># Paused</span>
          )}
        </div>

        {/* Headers section */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setHeadersExpanded(v => !v)}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:cursor-default"
          >
            <ChevronRight
              size={14}
              className={clsx(
                "transition-transform",
                headersExpanded && "rotate-90",
              )}
            />
            Headers
          </button>
          {headersExpanded && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 mt-1 dark:border-zinc-700/60 dark:bg-zinc-800/30">
              <HeadersEditor
                headers={form.headers}
                onChange={v => updateForm("headers", v)}
              />
            </div>
          )}
        </div>

        {/* Body section */}
        <div className="mt-2">
          {form.body == null ? (
            <button
              type="button"
              onClick={() => {
                updateForm("body", "")
                setBodyExpanded(true)
              }}
              className="text-xs text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-500 dark:hover:text-emerald-400"
            >
              + add body
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setBodyExpanded(v => !v)}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:cursor-default"
              >
                <ChevronRight
                  size={14}
                  className={clsx(
                    "transition-transform",
                    bodyExpanded && "rotate-90",
                  )}
                />
                Body
              </button>
              {bodyExpanded && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 mt-1 dark:border-zinc-700/60 dark:bg-zinc-800/30">
                  <textarea
                    value={form.body}
                    onChange={e => updateForm("body", e.target.value)}
                    rows={4}
                    placeholder='{"key": "value"}'
                    className={clsx(
                      termInputCls,
                      "text-zinc-700 dark:text-zinc-300 resize-none",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateForm("body", null)
                      setBodyExpanded(false)
                    }}
                    className="mt-1 text-xs text-red-500 transition-colors hover:text-red-400 dark:text-red-400 dark:hover:text-red-300"
                  >
                    − remove body
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {error != null && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 mt-3 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
