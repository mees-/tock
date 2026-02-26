import { useState } from "react"
import { useLocation } from "wouter"
import { useMutation } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import { inputCls as baseInputCls } from "@/lib/styles"

const CreateJobMutation = graphql(`
  mutation CreateJob($input: CreateJobInput!) {
    createJob(input: $input) {
      id
    }
  }
`)

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const

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

const CRON_FIELDS = ["sec", "min", "hour", "day", "mon", "wday"]

type Header = { key: string; value: string }

function HeadersEditor({ headers, onChange }: { headers: Header[]; onChange: (headers: Header[]) => void }) {
  function addRow() {
    onChange([...headers, { key: "", value: "" }])
  }

  function removeRow(index: number) {
    onChange(headers.filter((_, i) => i !== index))
  }

  function updateRow(index: number, field: "key" | "value", value: string) {
    onChange(headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)))
  }

  return (
    <div className="rounded-lg border border-zinc-300 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <datalist id="header-names">
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
                list="header-names"
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
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-600">No headers configured.</p>
      )}

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-500 dark:hover:text-emerald-400"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add header
      </button>
    </div>
  )
}

export default function NewJobPage() {
  const [, navigate] = useLocation()
  const [, createJob] = useMutation(CreateJobMutation)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: "",
    description: "",
    endpoint: "",
    method: "GET",
    headers: [] as Header[],
    body: "",
    cronExpression: "0 * * * * *",
  })

  function update<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const headersObj = Object.fromEntries(
      form.headers.filter(h => h.key.trim() !== "").map(h => [h.key.trim(), h.value]),
    )

    const result = await createJob({
      input: {
        name: form.name,
        description: form.description || undefined,
        endpoint: form.endpoint,
        method: form.method,
        headers: JSON.stringify(headersObj),
        body: form.body || undefined,
        cronExpression: form.cronExpression,
      },
    })

    setLoading(false)

    if (result.error != null) {
      setError(result.error.graphQLErrors[0]?.message ?? "Failed to create job")
      return
    }

    const id = result.data?.createJob.id
    navigate(id != null ? `/jobs/${id}` : "/jobs")
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">New job</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error != null && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        <Field label="Name">
          <input
            type="text"
            value={form.name}
            onChange={e => update("name", e.target.value)}
            required
            className={inputCls}
          />
        </Field>

        <Field label="Description" optional>
          <input
            type="text"
            value={form.description}
            onChange={e => update("description", e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="flex gap-3">
          <Field label="Method" className="w-36">
            <select value={form.method} onChange={e => update("method", e.target.value)} className={inputCls}>
              {HTTP_METHODS.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Endpoint URL" className="flex-1">
            <input
              type="url"
              value={form.endpoint}
              onChange={e => update("endpoint", e.target.value)}
              required
              placeholder="https://example.com/webhook"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Cron expression">
          <input
            type="text"
            value={form.cronExpression}
            onChange={e => update("cronExpression", e.target.value)}
            required
            placeholder="0 * * * * *"
            className={`${inputCls} font-mono`}
          />
          <div className="mt-1.5 grid grid-cols-6 gap-1 text-center font-mono text-[10px] text-zinc-500 dark:text-zinc-600">
            {CRON_FIELDS.map(f => (
              <span key={f} className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                {f}
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-600">
            Example: <code className="text-zinc-600 dark:text-zinc-400">0 * * * * *</code> = every minute at second 0.
          </p>
        </Field>

        <Field label="Headers" optional>
          <HeadersEditor headers={form.headers} onChange={v => update("headers", v)} />
        </Field>

        <Field label="Request body" optional>
          <textarea
            value={form.body}
            onChange={e => update("body", e.target.value)}
            rows={4}
            placeholder='{"key": "value"}'
            className={`${inputCls} font-mono`}
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create job"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/jobs")}
            className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

const inputCls = baseInputCls

const nestedInputCls =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-600"

function Field({
  label,
  optional,
  className,
  children,
}: {
  label: string
  optional?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {label}
        {optional === true && <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-600">(optional)</span>}
      </label>
      {children}
    </div>
  )
}
