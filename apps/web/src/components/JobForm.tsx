import React, { useEffect, useMemo, useReducer, useState } from "react"
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
import { z } from "zod"
import { useForm, Controller } from "react-hook-form"

export type { Header }

const METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const

function isValidCron(s: string) {
  try {
    cronstrue.toString(s.trim())
    return true
  } catch {
    return false
  }
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  endpoint: z.string().url("Must be a valid URL"),
  method: z.enum(METHODS, { error: "Invalid HTTP method" }),
  cronExpression: z.string().refine(isValidCron, "Invalid cron expression"),
  headers: z.array(z.object({ key: z.string(), value: z.string() })),
  body: z.string().nullable(),
})

function zv<T>(fieldSchema: z.ZodType<T>) {
  return (value: T) => {
    const result = fieldSchema.safeParse(value)
    return result.success
      ? true
      : (result.error.issues[0]?.message ?? "Invalid")
  }
}

type JobFormValues = z.infer<typeof schema>

export type { JobFormValues }

export const NEW_JOB_DEFAULTS: JobFormValues = {
  name: "",
  description: "",
  endpoint: "",
  method: "GET",
  cronExpression: "0 * * * *",
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

function FormActionHint({
  handleSubmit,
  submitting,
  isNew,
  hasErrors,
}: {
  handleSubmit: () => void
  submitting: boolean
  isNew: boolean
  hasErrors: boolean
}) {
  const isTouchScreen = useMediaQuery("(hover: none)")
  useHotkeys(`mod-Enter`, handleSubmit)
  const isMacOs = globalThis.navigator.platform.startsWith("Mac")

  if (hasErrors) {
    return (
      <span className="text-xs text-zinc-400 cursor-default dark:text-zinc-600">
        {isNew ? "Fix the errors" : "Fix the errors in the form"}
      </span>
    )
  }

  const shortCutText = isMacOs ? "⌘+⏎" : "Ctrl+⏎"

  const actionText = submitting
    ? isNew
      ? "Creating…"
      : "Saving…"
    : isNew
      ? `Create (${shortCutText})`
      : isTouchScreen
        ? "Save"
        : `Save (${shortCutText})`

  return (
    <button
      type="submit"
      disabled={submitting}
      className={clsx(
        "text-xs transition-colors disabled:opacity-50",
        isTouchScreen
          ? "px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-700 cursor-default text-zinc-600 hover:text-zinc-300"
          : "text-zinc-400 hover:text-zinc-700 cursor-default dark:text-zinc-600 dark:hover:text-zinc-300",
      )}
    >
      {actionText}
    </button>
  )
}

function FormInput({
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <span className="relative">
      <input
        autoComplete="off"
        {...props}
        className={clsx(
          className,
          error && "underline decoration-wavy decoration-red-500",
        )}
        onMouseEnter={() => error && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={() => error && setHovered(true)}
        onTouchEnd={() => setHovered(false)}
      />
      {hovered && error && (
        <span className="absolute bottom-full left-0 z-50 mb-1 whitespace-nowrap rounded border border-red-500/30 bg-zinc-900 px-2 py-1 font-mono text-xs text-red-400 shadow-lg dark:bg-zinc-950">
          {error}
        </span>
      )}
    </span>
  )
}

export function JobForm(props: JobFormProps) {
  const isNew = props.jobId == null
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isDirty, isSubmitting, isValid },
  } = useForm<JobFormValues>({
    mode: "onChange",
    defaultValues: {
      ...NEW_JOB_DEFAULTS,
      ...(props.initialValues ?? {}),
    },
  })

  const method = watch("method")
  const cronExpression = watch("cronExpression")

  const hasChanges = isDirty
  const submitting = isSubmitting
  const hasErrors = !isValid && isDirty

  const [headersExpanded, setHeadersExpanded] = useState(
    () => (props.initialValues?.headers ?? []).length > 0,
  )
  const [bodyExpanded, setBodyExpanded] = useState(
    () => props.initialValues?.body != null,
  )

  const handleSubmit = rhfHandleSubmit(async values => {
    setError(null)
    try {
      await props.onSubmit(values)
      reset(values)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    }
  })

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Title bar */}
      <div className="flex items-center gap-2.5 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="ml-2 flex-1 text-xs text-zinc-500">Job config</span>

        <div className="flex items-center gap-1">
          {(hasChanges || hasErrors) && (
            <FormActionHint
              handleSubmit={handleSubmit}
              submitting={submitting}
              isNew={isNew}
              hasErrors={hasErrors}
            />
          )}
          {props.onToggle != null && (
            <button
              onClick={props.onToggle}
              className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {props.isActive ? <Pause size={12} /> : <Play size={12} />}
              {props.isActive ? "Pause" : "Resume"}
            </button>
          )}
          {props.onDelete != null && (
            <button
              onClick={props.onDelete}
              className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-red-500 transition-colors hover:text-red-400"
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
          <FormInput
            type="text"
            {...register("name", { validate: zv(schema.shape.name) })}
            error={errors.name?.message}
            className={clsx(termInputCls, "text-zinc-900 dark:text-white")}
          />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-zinc-500">desc:</span>
          <input
            type="text"
            {...register("description")}
            className={clsx(termInputCls, "text-zinc-600 dark:text-zinc-400")}
          />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-zinc-500">method:</span>
          <FormInput
            type="text"
            {...register("method", {
              setValueAs: (v: string) => v.toUpperCase(),
              validate: zv(schema.shape.method),
            })}
            error={errors.method?.message}
            className={clsx(termInputCls, methodColor(method), "w-28")}
          />
        </div>

        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-zinc-500">endpoint:</span>
          <FormInput
            type="text"
            {...register("endpoint", { validate: zv(schema.shape.endpoint) })}
            error={errors.endpoint?.message}
            className={clsx(termInputCls, "grow text-blue-600 dark:text-blue-400")}
          />
        </div>

        <div className="flex items-baseline gap-2 flex-wrap gap-y-1">
          <span className="shrink-0 text-zinc-500">schedule:</span>
          <FormInput
            type="text"
            {...register("cronExpression", {
              validate: zv(schema.shape.cronExpression),
            })}
            error={errors.cronExpression?.message}
            style={{
              width: `${Math.max(cronExpression.length, 1)}ch`,
            }}
            className={clsx(
              termInputCls,
              "text-zinc-900 dark:text-white w-auto mr-4",
              {
                "line-through text-zinc-400":
                  props.jobId != null && props.isActive === false,
              },
            )}
          />
          {props.isActive ? (
            <CronComment expr={cronExpression} />
          ) : (
            <span className="text-zinc-600"># Paused</span>
          )}
        </div>

        {/* Headers section */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setHeadersExpanded(v => !v)}
            className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:cursor-default"
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
              <Controller
                control={control}
                name="headers"
                render={({ field }) => (
                  <HeadersEditor
                    headers={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          )}
        </div>

        {/* Body section */}
        <div className="mt-2">
          <Controller
            control={control}
            name="body"
            render={({ field }) => (
              <>
                {field.value == null ? (
                  <button
                    type="button"
                    onClick={() => {
                      field.onChange("")
                      setBodyExpanded(true)
                    }}
                    className="cursor-pointer text-xs text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-500 dark:hover:text-emerald-400"
                  >
                    + add body
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setBodyExpanded(v => !v)}
                      className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors disabled:cursor-default"
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
                          value={field.value}
                          onChange={e => field.onChange(e.target.value)}
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
                            field.onChange(null)
                            setBodyExpanded(false)
                          }}
                          className="mt-1 cursor-pointer text-xs text-red-500 transition-colors hover:text-red-400 dark:text-red-400 dark:hover:text-red-300"
                        >
                          − remove body
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          />
        </div>

        {error != null && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 mt-3 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    </form>
  )
}
