import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import clsx from "clsx"
import cronstrue from "cronstrue"
import { Cron } from "croner"
import { DateTime } from "luxon"
import { Pause, Play, Trash2 } from "lucide-react"
import { termInputCls } from "@/lib/styles"
import { HeadersEditor } from "./HeadersEditor"
import type { Header, HeadersEditorHandle } from "./HeadersEditor"
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
    new Cron(s, { paused: true }, () => {})
    return true
  } catch (e) {
    return false
  }
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  endpoint: z.httpUrl(),
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
  useHotkeys(
    `mod-Enter`,
    () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      handleSubmit()
    },
    { enableOnFormTags: true },
  )
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
  onChange,
  onKeyDown,
  ref: forwardedRef,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string
  ref?: React.Ref<HTMLInputElement>
}) {
  const innerRef = useRef<HTMLInputElement | null>(null)

  const ref = useCallback(
    (el: HTMLInputElement | null) => {
      innerRef.current = el
      if (typeof forwardedRef === "function") forwardedRef(el)
      else if (forwardedRef != null)
        (
          forwardedRef as React.MutableRefObject<HTMLInputElement | null>
        ).current = el
    },
    [forwardedRef],
  )

  return (
    <div className="flex items-baseline min-w-0 grow">
      <input
        ref={ref}
        autoComplete="off"
        onChange={e => {
          onChange?.(e)
        }}
        onKeyDown={onKeyDown}
        {...props}
        className={clsx(
          className,
          "min-w-[10ch]",
          error && "underline decoration-wavy decoration-red-500",
        )}
      />
      {error && <span className="text-red-500 shrink-0">← {error}</span>}
    </div>
  )
}

function ConfigLine({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLButtonElement ||
      e.target instanceof HTMLSelectElement
    )
      return
    containerRef.current?.querySelector<HTMLInputElement>("input")?.focus()
  }, [])

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={clsx("flex items-baseline gap-2 cursor-text", className)}
    >
      <span className="shrink-0 cursor-default text-zinc-500">{label}</span>
      {children}
    </div>
  )
}

/** Field index constants for navigation */
const FIELD_NAME = 0
const FIELD_DESC = 1
const FIELD_METHOD = 2
const FIELD_ENDPOINT = 3
const FIELD_SCHEDULE = 4
const FIELD_HEADERS = 5
const FIELD_BODY = 6

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

  // Refs for all navigable fields
  const fieldRefs = useRef<
    Array<HTMLInputElement | HTMLTextAreaElement | null>
  >([])
  const headersEditorRef = useRef<HeadersEditorHandle | null>(null)

  const focusField = useCallback((index: number) => {
    if (index === FIELD_HEADERS) {
      headersEditorRef.current?.enter()
    } else if (index === FIELD_BODY) {
      fieldRefs.current[FIELD_BODY]?.focus()
    } else {
      fieldRefs.current[index]?.focus()
    }
  }, [])

  const makeFieldKeyHandler = useCallback(
    (fieldIndex: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        focusField(fieldIndex + 1)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        focusField(fieldIndex + 1)
      } else if (e.key === "ArrowUp" && fieldIndex > 0) {
        e.preventDefault()
        focusField(fieldIndex - 1)
      }
    },
    [focusField],
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

      {/* Body — scrollable like a code editor */}
      <div className="overflow-auto px-5 py-4 font-mono text-sm leading-relaxed space-y-1">
        <ConfigLine label="name:">
          <FormInput
            type="text"
            {...register("name", { validate: zv(schema.shape.name) })}
            ref={el => {
              fieldRefs.current[FIELD_NAME] = el
              register("name").ref(el)
            }}
            onKeyDown={makeFieldKeyHandler(FIELD_NAME)}
            error={errors.name?.message}
            className={clsx(termInputCls, "text-zinc-900 dark:text-white")}
          />
        </ConfigLine>

        <ConfigLine label="desc:">
          <FormInput
            type="text"
            {...register("description")}
            ref={el => {
              fieldRefs.current[FIELD_DESC] = el
              register("description").ref(el)
            }}
            onKeyDown={makeFieldKeyHandler(FIELD_DESC)}
            className={clsx(termInputCls, "text-zinc-600 dark:text-zinc-400")}
          />
        </ConfigLine>

        <ConfigLine label="method:">
          <FormInput
            type="text"
            {...register("method", {
              setValueAs: (v: string) => v.toUpperCase(),
              validate: zv(schema.shape.method),
            })}
            ref={el => {
              fieldRefs.current[FIELD_METHOD] = el
              register("method").ref(el)
            }}
            onKeyDown={makeFieldKeyHandler(FIELD_METHOD)}
            error={errors.method?.message}
            className={clsx(termInputCls, methodColor(method), "w-28")}
          />
        </ConfigLine>

        <ConfigLine label="endpoint:">
          <FormInput
            type="text"
            {...register("endpoint", { validate: zv(schema.shape.endpoint) })}
            ref={el => {
              fieldRefs.current[FIELD_ENDPOINT] = el
              register("endpoint").ref(el)
            }}
            onKeyDown={makeFieldKeyHandler(FIELD_ENDPOINT)}
            error={errors.endpoint?.message}
            className={clsx(
              termInputCls,
              "grow text-blue-600 dark:text-blue-400",
            )}
          />
        </ConfigLine>

        <ConfigLine label="schedule:" className="flex-wrap gap-y-1">
          <FormInput
            type="text"
            {...register("cronExpression", {
              validate: zv(schema.shape.cronExpression),
            })}
            ref={el => {
              fieldRefs.current[FIELD_SCHEDULE] = el
              register("cronExpression").ref(el)
            }}
            onKeyDown={makeFieldKeyHandler(FIELD_SCHEDULE)}
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
          {props.isActive || isNew ? (
            <CronComment expr={cronExpression} />
          ) : (
            <span className="text-zinc-600"># Paused</span>
          )}
        </ConfigLine>

        {/* Headers — inline, always visible */}
        <Controller
          control={control}
          name="headers"
          render={({ field }) => (
            <HeadersEditor
              headers={field.value}
              onChange={field.onChange}
              ref={headersEditorRef}
              onExitDown={() => focusField(FIELD_BODY)}
              onExitUp={() => focusField(FIELD_SCHEDULE)}
            />
          )}
        />

        {/* Body — inline, always visible */}
        <Controller
          control={control}
          name="body"
          render={({ field }) => (
            <div className="flex items-start gap-2">
              <span className="shrink-0 cursor-default text-zinc-500 leading-relaxed">
                body:
              </span>
              <div className="flex-1 min-w-0">
                <textarea
                  ref={el => {
                    fieldRefs.current[FIELD_BODY] = el
                  }}
                  value={field.value ?? ""}
                  onChange={e => {
                    const val = e.target.value
                    field.onChange(val === "" ? null : val)
                  }}
                  onKeyDown={e => {
                    if (e.key === "ArrowUp") {
                      const el = e.currentTarget
                      // If cursor is on the first line, exit upward
                      if (el.selectionStart != null) {
                        const textBefore = el.value.slice(0, el.selectionStart)
                        if (!textBefore.includes("\n")) {
                          e.preventDefault()
                          focusField(FIELD_HEADERS)
                        }
                      }
                    }
                  }}
                  rows={Math.max(1, (field.value ?? "").split("\n").length)}
                  placeholder='{"key": "value"}'
                  className={clsx(
                    termInputCls,
                    "w-full text-zinc-700 dark:text-zinc-300 resize-none leading-relaxed",
                  )}
                  spellCheck={false}
                />
              </div>
            </div>
          )}
        />

        {error != null && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 mt-3 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    </form>
  )
}
