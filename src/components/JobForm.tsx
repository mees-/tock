import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import { flushSync } from "react-dom"
import clsx from "clsx"
import cronstrue from "cronstrue"
import { Cron } from "croner"
import { DateTime } from "luxon"
import { Pause, Play, Trash2 } from "lucide-react"
import { termInputCls } from "@/lib/styles"
import { useEditHistory } from "@/lib/useEditHistory"
import { completeCron, completeMethod, HTTP_METHODS } from "@/lib/completions"
import { formatJson, jsonProblem, looksLikeJson } from "@/lib/json"
import { isMacOs, shortcut } from "@/lib/platform"
import {
  HeadersEditor,
  isHeaderLineValid,
  parseHeaderLine,
  toHeaderLine,
} from "./HeadersEditor"
import type { HeadersEditorHandle } from "./HeadersEditor"
import { BodyEditor } from "./editor/BodyEditor"
import { CommandPalette } from "./editor/CommandPalette"
import type { Command } from "./editor/CommandPalette"
import { useCompletion } from "./editor/Completion"
import type { Completion } from "./editor/Completion"
import { EditorLine } from "./editor/EditorLine"
import { StatusBar } from "./editor/StatusBar"
import { useCaret } from "./editor/useCaret"
import { useMediaQuery } from "usehooks-ts"
import { useHotkeys } from "react-hotkeys-hook"
import { z } from "zod"
import { useForm, Controller } from "react-hook-form"

// The scheduler runs once per minute, so seconds fields aren't supported.
const CRON_FIELD_COUNT = 5

function isValidCron(s: string) {
  if (s.trim().split(/\s+/).length !== CRON_FIELD_COUNT) return false
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
  method: z.enum(HTTP_METHODS, { error: "Invalid HTTP method" }),
  cronExpression: z
    .string()
    .refine(isValidCron, "Invalid cron expression (use 5 fields)"),
  headers: z.array(z.string()),
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

export function headersToRecord(lines: string[]) {
  return Object.fromEntries(
    lines
      .map(parseHeaderLine)
      .filter(h => h.key.trim() !== "")
      .map(h => [h.key.trim(), h.value]),
  )
}

export function headerLinesFromRecord(headers: Record<string, string>) {
  return Object.entries(headers).map(([key, value]) =>
    toHeaderLine({ key, value }),
  )
}

type FieldName = keyof JobFormValues
type TextFieldName = Exclude<FieldName, "headers" | "body">

const SAVE_KEYS = "mod+s, mod+enter"
const UNDO_KEYS = isMacOs ? "mod+z, mod+shift+z" : "mod+z, mod+shift+z, ctrl+y"
const PALETTE_KEYS = "mod+k, mod+shift+p"
const NEXT_PROBLEM_KEY = "f8"
const FIELD_NAMES = Object.keys(schema.shape) as FieldName[]

const FIELD_LABELS: Record<FieldName, string> = {
  name: "name",
  description: "desc",
  method: "method",
  endpoint: "endpoint",
  cronExpression: "schedule",
  headers: "headers",
  body: "body",
}

const FIELD_MODES: Record<TextFieldName, string> = {
  name: "Text",
  description: "Text",
  method: "HTTP Method",
  endpoint: "URL",
  cronExpression: "Cron",
}

/** Line numbers of the fixed lines; header lines and the body follow. */
const LINES = {
  name: 1,
  description: 2,
  method: 3,
  endpoint: 4,
  cronExpression: 5,
  headers: 6,
} as const

type FieldElement = HTMLInputElement | HTMLTextAreaElement

/** Text of a `data-field` path such as `endpoint` or `headers.2`. */
function fieldText(values: JobFormValues, field: string) {
  const [name, index] = field.split(".")
  if (name === "headers") return values.headers[Number(index)]
  const value = values[name as FieldName]
  if (value == null) return ""
  return typeof value === "string" ? value : undefined
}

/** Caret offset in `to` just after the part that differs from `from`. */
function changeEnd(from: string, to: string) {
  const shorter = Math.min(from.length, to.length)
  let prefix = 0
  while (prefix < shorter && from[prefix] === to[prefix]) prefix++
  let suffix = 0
  while (
    suffix < shorter - prefix &&
    from[from.length - 1 - suffix] === to[to.length - 1 - suffix]
  )
    suffix++
  return to.length - suffix
}

function activeField() {
  const el = document.activeElement
  return el instanceof HTMLElement ? (el.dataset.field ?? null) : null
}

function lineIndexAt(text: string, offset: number) {
  return text.slice(0, offset).split("\n").length - 1
}

type Problem = {
  field: string
  line: number
  offset?: number
  severity: "error" | "warning"
  message: string
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
      <>
        # {description.toLowerCase()}
        {nextRunFormatted != null && <> → next: {nextRunFormatted}</>}
      </>
    )
  } catch {
    return null
  }
}

function FormActionHint({
  submitting,
  isNew,
  hasErrors,
}: {
  submitting: boolean
  isNew: boolean
  hasErrors: boolean
}) {
  const isTouchScreen = useMediaQuery("(hover: none)")

  if (hasErrors) {
    return (
      <span className="text-xs text-zinc-400 cursor-default dark:text-zinc-600">
        {isNew ? "Fix the errors" : "Fix the errors in the form"}
      </span>
    )
  }

  const shortCutText = shortcut("⌘S", "Ctrl+S")

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
  comment,
  className,
  valueLength,
  completion,
  onKeyDown,
  onBlur,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string
  comment?: React.ReactNode
  valueLength: number
  completion?: Completion
  ref?: React.Ref<HTMLInputElement>
}) {
  const ghost = completion?.ghost ?? ""
  return (
    <div className="flex min-w-0 grow flex-wrap items-baseline">
      <div
        className="relative mr-2 min-w-0 grow"
        style={{ maxWidth: `${Math.max(valueLength + ghost.length + 1, 2)}ch` }}
      >
        <input
          autoComplete="off"
          spellCheck={false}
          {...props}
          onKeyDown={e => {
            completion?.handlers.onKeyDown(e)
            if (!e.defaultPrevented) onKeyDown?.(e)
          }}
          onInput={completion?.handlers.onInput}
          onSelect={completion?.handlers.onSelect}
          onBlur={e => {
            completion?.handlers.onBlur()
            onBlur?.(e)
          }}
          className={clsx(
            className,
            "h-6 w-full",
            error && "underline decoration-wavy decoration-red-500",
          )}
        />
        {ghost !== "" && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 whitespace-pre text-zinc-400 dark:text-zinc-600"
            style={{ left: `${valueLength}ch` }}
          >
            {ghost}
          </span>
        )}
        {completion?.popup}
      </div>
      {error && <span className="min-w-0 text-red-500">← {error}</span>}
      {!error && comment && (
        <span className="min-w-0 text-zinc-600">{comment}</span>
      )}
    </div>
  )
}

function ConfigLine({
  label,
  line,
  active,
  problem,
  children,
}: {
  label: string
  line: number
  active: boolean
  problem: boolean
  children: React.ReactNode
}) {
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLButtonElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLLIElement
    )
      return
    e.currentTarget.querySelector<HTMLInputElement>("input")?.focus()
  }, [])

  return (
    <EditorLine
      number={line}
      activeLine={active ? 0 : null}
      problemLines={problem ? [0] : []}
      className="cursor-text"
      onClick={handleClick}
    >
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 cursor-default text-zinc-500">{label}:</span>
        {children}
      </div>
    </EditorLine>
  )
}

const FIELD_ORDER: FieldName[] = [
  "name",
  "description",
  "method",
  "endpoint",
  "cronExpression",
  "headers",
  "body",
]

export function JobForm(props: JobFormProps) {
  const isNew = props.jobId == null
  const [error, setError] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteReturnFocus = useRef<HTMLElement | null>(null)
  const headersEditorRef = useRef<HeadersEditorHandle | null>(null)

  const [initialValues] = useState(() => ({
    ...NEW_JOB_DEFAULTS,
    ...(props.initialValues ?? {}),
  }))

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    control,
    watch,
    getValues,
    setValue,
    reset,
    formState: { errors, isDirty, isSubmitting, isValid },
  } = useForm<JobFormValues>({
    mode: "onChange",
    defaultValues: initialValues,
  })

  const values = watch()
  const { method, cronExpression } = values
  const bodyText = values.body ?? ""

  const hasErrors = !isValid && isDirty

  function fieldElement(field: string) {
    return formRef.current?.querySelector<FieldElement>(
      `[data-field="${field}"]`,
    )
  }

  function focusField(name: FieldName, position: "first" | "last" = "first") {
    if (name === "headers") headersEditorRef.current?.enter(position)
    else fieldElement(name)?.focus()
  }

  function focusSibling(name: FieldName, step: 1 | -1) {
    const target = FIELD_ORDER[FIELD_ORDER.indexOf(name) + step]
    if (target != null) focusField(target, step === -1 ? "last" : "first")
  }

  /** Writes a value as its own undo step and places the caret. */
  function replaceValue(name: TextFieldName, value: string, caret: number) {
    history.seal()
    setValue(name, value, { shouldDirty: true, shouldValidate: true })
    history.seal()
    fieldElement(name)?.setSelectionRange(caret, caret)
  }

  function fieldKeyHandler(name: TextFieldName) {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      const mod = isMacOs ? e.metaKey : e.ctrlKey
      if (mod && e.shiftKey && e.code === "KeyK") {
        e.preventDefault()
        replaceValue(name, "", 0)
      } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        focusSibling(name, 1)
      } else if (e.key === "ArrowDown" && !e.altKey) {
        e.preventDefault()
        focusSibling(name, 1)
      } else if (e.key === "ArrowUp" && !e.altKey) {
        e.preventDefault()
        focusSibling(name, -1)
      }
    }
  }

  const methodCompletion = useCompletion(completeMethod, (value, caret) =>
    replaceValue("method", value, caret),
  )
  const cronCompletion = useCompletion(completeCron, (value, caret) =>
    replaceValue("cronExpression", value, caret),
  )

  const handleSubmit = rhfHandleSubmit(async submitted => {
    setError(null)
    try {
      await props.onSubmit(submitted)
      // Keep edits typed while the request was in flight.
      reset(submitted, { keepValues: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    }
  })

  function save() {
    if (isDirty && !isSubmitting) void handleSubmit()
  }

  const history = useEditHistory(initialValues, (snapshot, field) => {
    const previous = getValues()
    flushSync(() => {
      for (const name of FIELD_NAMES) {
        setValue(name, snapshot[name], {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
    })
    const el = field == null ? null : fieldElement(field)
    if (field == null || el == null) {
      // The edited field may be gone (a removed header line); stay in the form.
      if (!formRef.current?.contains(document.activeElement)) {
        formRef.current?.focus({ preventScroll: true })
      }
      return
    }
    const text = fieldText(snapshot, field) ?? ""
    const caret = changeEnd(fieldText(previous, field) ?? "", text)
    el.focus()
    el.setSelectionRange(caret, caret)
  })

  useEffect(() => {
    let headerCount = getValues().headers.length
    const subscription = watch(() => {
      const snapshot = structuredClone(getValues())
      const linesChanged = snapshot.headers.length !== headerCount
      headerCount = snapshot.headers.length
      history.record(snapshot, activeField(), { coalesce: !linesChanged })
    })
    return () => subscription.unsubscribe()
  }, [watch, getValues, history])

  const formRef = useHotkeys<HTMLFormElement>(
    UNDO_KEYS,
    e =>
      e.shiftKey || e.key.toLowerCase() === "y"
        ? history.redo()
        : history.undo(),
    { enableOnFormTags: true, preventDefault: true },
  )

  const caret = useCaret(formRef)

  const bodyLine = LINES.headers + 1 + values.headers.length
  const bodyLineCount = Math.max(1, bodyText.split("\n").length)
  const bodyProblem = jsonProblem(bodyText)

  function lineOf(field: string) {
    const [name, index] = field.split(".")
    if (name === "headers") return LINES.headers + 1 + Number(index)
    if (name === "body") return bodyLine
    return LINES[name as keyof typeof LINES]
  }

  const problems: Problem[] = [
    ...(["name", "method", "endpoint", "cronExpression"] as const).flatMap(
      name => {
        const message = errors[name]?.message
        if (message == null) return []
        return [
          {
            field: name,
            line: LINES[name],
            severity: "error" as const,
            message,
          },
        ]
      },
    ),
    ...values.headers.flatMap((raw, i) =>
      isHeaderLineValid(raw)
        ? []
        : [
            {
              field: `headers.${i}`,
              line: LINES.headers + 1 + i,
              severity: "warning" as const,
              message: "Invalid header",
            },
          ],
    ),
    ...(bodyProblem == null
      ? []
      : [
          {
            field: "body",
            line: bodyLine + lineIndexAt(bodyText, bodyProblem.offset),
            offset: bodyProblem.offset,
            severity: "warning" as const,
            message: bodyProblem.message,
          },
        ]),
  ]

  const position =
    caret == null
      ? null
      : { line: lineOf(caret.field) + caret.line, col: caret.col + 1 }

  function modeOf(field: string | undefined) {
    if (field == null) return null
    if (field.startsWith("headers")) return "HTTP Headers"
    if (field === "body") return looksLikeJson(bodyText) ? "JSON" : "Plain Text"
    return FIELD_MODES[field as TextFieldName] ?? null
  }

  function goToNextProblem() {
    const current = position?.line ?? 0
    const problem = problems.find(p => p.line > current) ?? problems[0]
    if (problem == null) return
    const el = fieldElement(problem.field)
    if (el == null) return
    const offset = problem.offset ?? el.value.length
    el.focus()
    el.setSelectionRange(offset, offset)
  }

  function formatBody() {
    const formatted = formatJson(bodyText)
    if (formatted == null) return
    history.seal()
    setValue("body", formatted, { shouldDirty: true, shouldValidate: true })
    history.seal()
    focusField("body")
  }

  function openPalette() {
    if (paletteOpen) return
    paletteReturnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setPaletteOpen(true)
  }

  function closePalette() {
    setPaletteOpen(false)
    const el = paletteReturnFocus.current
    if (el?.isConnected === true && el !== document.body) el.focus()
    else formRef.current?.focus({ preventScroll: true })
  }

  const commands: Command[] = [
    {
      id: "save",
      label: isNew ? "Create job" : "Save",
      shortcut: shortcut("⌘S", "Ctrl+S"),
      run: save,
    },
    {
      id: "undo",
      label: "Undo",
      shortcut: shortcut("⌘Z", "Ctrl+Z"),
      run: history.undo,
    },
    {
      id: "redo",
      label: "Redo",
      shortcut: shortcut("⇧⌘Z", "Ctrl+Y"),
      run: history.redo,
    },
    ...(problems.length > 0
      ? [
          {
            id: "problem",
            label: "Go to next problem",
            shortcut: "F8",
            run: goToNextProblem,
          },
        ]
      : []),
    ...(looksLikeJson(bodyText)
      ? [
          {
            id: "format",
            label: "Format body",
            shortcut: shortcut("⇧⌥F", "Shift+Alt+F"),
            run: formatBody,
          },
        ]
      : []),
    {
      id: "add-header",
      label: "Add header",
      run: () => headersEditorRef.current?.add(),
    },
    ...FIELD_ORDER.map(name => ({
      id: `go-${name}`,
      label: `Go to ${FIELD_LABELS[name]}`,
      run: () => focusField(name),
    })),
    ...(props.onToggle == null
      ? []
      : [
          {
            id: "toggle",
            label: props.isActive ? "Pause job" : "Resume job",
            run: () => void props.onToggle?.(),
          },
        ]),
    ...(props.onDelete == null
      ? []
      : [
          {
            id: "delete",
            label: "Delete job",
            run: () => void props.onDelete?.(),
          },
        ]),
  ]

  useHotkeys(
    SAVE_KEYS,
    save,
    { enableOnFormTags: true, preventDefault: true },
    [isDirty, isSubmitting, handleSubmit],
  )
  useHotkeys(
    PALETTE_KEYS,
    openPalette,
    { enableOnFormTags: true, preventDefault: true },
    [paletteOpen],
  )
  useHotkeys(
    NEXT_PROBLEM_KEY,
    goToNextProblem,
    { enableOnFormTags: true, preventDefault: true },
    [problems, position],
  )

  // Undo/Redo from the browser's Edit menu.
  useEffect(() => {
    const form = formRef.current
    if (form == null) return
    function onBeforeInput(e: InputEvent) {
      if (e.inputType === "historyUndo") {
        e.preventDefault()
        history.undo()
      } else if (e.inputType === "historyRedo") {
        e.preventDefault()
        history.redo()
      }
    }
    form.addEventListener("beforeinput", onBeforeInput)
    return () => form.removeEventListener("beforeinput", onBeforeInput)
  }, [formRef, history])

  useEffect(() => {
    if (!isDirty) return
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [isDirty])

  const errorCount = problems.filter(p => p.severity === "error").length
  const saveState = isSubmitting
    ? isNew
      ? "Creating…"
      : "Saving…"
    : isDirty
      ? "Modified"
      : isNew
        ? "Not created"
        : "Saved"

  const isActiveLine = (field: string) => caret?.field === field
  const hasProblem = (field: string) => problems.some(p => p.field === field)

  return (
    <form
      ref={formRef}
      // Clicks on the form chrome keep focus inside, so undo stays scoped to it.
      tabIndex={-1}
      onSubmit={handleSubmit}
      className="rounded-xl border border-zinc-200 bg-white shadow-lg outline-none dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Title bar */}
      <div className="flex items-center gap-2.5 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="ml-2 flex min-w-0 flex-1 items-center gap-1.5 font-mono text-xs text-zinc-500">
          <span className="truncate">
            <span className="text-zinc-800 dark:text-zinc-200">
              {values.name.trim() === "" ? "untitled" : values.name.trim()}
            </span>
            .job
          </span>
          {isDirty && (
            <span title="Unsaved changes" className="text-zinc-400">
              ●
            </span>
          )}
        </span>

        <div className="flex items-center gap-1">
          {(isDirty || hasErrors) && (
            <FormActionHint
              submitting={isSubmitting}
              isNew={isNew}
              hasErrors={hasErrors}
            />
          )}
          {props.onToggle != null && (
            <button
              type="button"
              onClick={props.onToggle}
              className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {props.isActive ? <Pause size={12} /> : <Play size={12} />}
              {props.isActive ? "Pause" : "Resume"}
            </button>
          )}
          {props.onDelete != null && (
            <button
              type="button"
              onClick={props.onDelete}
              className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-red-500 transition-colors hover:text-red-400"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="py-3 font-mono text-sm leading-6">
        <ConfigLine
          label={FIELD_LABELS.name}
          line={LINES.name}
          active={isActiveLine("name")}
          problem={hasProblem("name")}
        >
          <FormInput
            type="text"
            {...register("name", { validate: zv(schema.shape.name) })}
            onKeyDown={fieldKeyHandler("name")}
            data-field="name"
            valueLength={values.name.length}
            error={errors.name?.message}
            className={clsx(termInputCls, "text-zinc-900 dark:text-white")}
          />
        </ConfigLine>

        <ConfigLine
          label={FIELD_LABELS.description}
          line={LINES.description}
          active={isActiveLine("description")}
          problem={false}
        >
          <FormInput
            type="text"
            {...register("description")}
            onKeyDown={fieldKeyHandler("description")}
            data-field="description"
            valueLength={values.description.length}
            className={clsx(termInputCls, "text-zinc-600 dark:text-zinc-400")}
          />
        </ConfigLine>

        <ConfigLine
          label={FIELD_LABELS.method}
          line={LINES.method}
          active={isActiveLine("method")}
          problem={hasProblem("method")}
        >
          <FormInput
            type="text"
            {...register("method", {
              setValueAs: (v: string) => v.toUpperCase(),
              validate: zv(schema.shape.method),
            })}
            onKeyDown={fieldKeyHandler("method")}
            completion={methodCompletion}
            data-field="method"
            valueLength={method.length}
            error={errors.method?.message}
            className={clsx(termInputCls, methodColor(method))}
          />
        </ConfigLine>

        <ConfigLine
          label={FIELD_LABELS.endpoint}
          line={LINES.endpoint}
          active={isActiveLine("endpoint")}
          problem={hasProblem("endpoint")}
        >
          <FormInput
            type="text"
            {...register("endpoint", { validate: zv(schema.shape.endpoint) })}
            onKeyDown={fieldKeyHandler("endpoint")}
            data-field="endpoint"
            valueLength={values.endpoint.length}
            error={errors.endpoint?.message}
            className={clsx(termInputCls, "text-blue-600 dark:text-blue-400")}
          />
        </ConfigLine>

        <ConfigLine
          label={FIELD_LABELS.cronExpression}
          line={LINES.cronExpression}
          active={isActiveLine("cronExpression")}
          problem={hasProblem("cronExpression")}
        >
          <FormInput
            type="text"
            {...register("cronExpression", {
              validate: zv(schema.shape.cronExpression),
            })}
            onKeyDown={fieldKeyHandler("cronExpression")}
            completion={cronCompletion}
            data-field="cronExpression"
            valueLength={cronExpression.length}
            error={errors.cronExpression?.message}
            comment={
              props.isActive || isNew ? (
                <CronComment expr={cronExpression} />
              ) : (
                <span className="text-zinc-600"># Paused</span>
              )
            }
            className={clsx(
              termInputCls,
              "text-zinc-900 dark:text-white",
              props.jobId != null &&
                props.isActive === false &&
                "line-through text-zinc-400",
            )}
          />
        </ConfigLine>

        <Controller
          control={control}
          name="headers"
          render={({ field }) => (
            <HeadersEditor
              lines={field.value}
              onChange={field.onChange}
              onSeal={history.seal}
              ref={headersEditorRef}
              firstLine={LINES.headers}
              cursorField={caret?.field ?? null}
              onExitDown={() => focusField("body")}
              onExitUp={() => focusField("cronExpression")}
            />
          )}
        />

        <Controller
          control={control}
          name="body"
          render={({ field }) => (
            <EditorLine
              number={bodyLine}
              count={bodyLineCount}
              activeLine={caret?.field === "body" ? caret.line : null}
              problemLines={
                bodyProblem == null
                  ? []
                  : [lineIndexAt(bodyText, bodyProblem.offset)]
              }
            >
              <div className="flex gap-2">
                <span
                  className="shrink-0 cursor-default text-zinc-500"
                  onClick={() => focusField("body")}
                >
                  {FIELD_LABELS.body}:
                </span>
                <BodyEditor
                  value={field.value ?? ""}
                  onChange={value =>
                    field.onChange(value === "" ? null : value)
                  }
                  onSeal={history.seal}
                  onExitUp={() => focusField("headers", "last")}
                  problem={bodyProblem}
                />
              </div>
            </EditorLine>
          )}
        />
        {bodyProblem != null && (
          <EditorLine number={null}>
            <span className="ml-[6ch] text-amber-600 dark:text-amber-400">
              # {bodyProblem.message}
            </span>
          </EditorLine>
        )}

        {error != null && (
          <div className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      <StatusBar
        position={position}
        mode={modeOf(caret?.field)}
        errors={errorCount}
        warnings={problems.length - errorCount}
        onProblemsClick={goToNextProblem}
        saveState={saveState}
        commandsShortcut={shortcut("⌘K", "Ctrl+K")}
      />

      {paletteOpen && (
        <CommandPalette commands={commands} onClose={closePalette} />
      )}
    </form>
  )
}
