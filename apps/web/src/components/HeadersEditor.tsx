import clsx from "clsx"
import { termInputCls } from "@/lib/styles"

export type Header = { key: string; value: string }

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

export function HeadersEditor({
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
                className={clsx(termInputCls, "text-zinc-300 w-44 shrink-0")}
              />
              <span className="shrink-0 text-zinc-500">: </span>
              <input
                type="text"
                value={header.value}
                onChange={e => updateRow(i, "value", e.target.value)}
                placeholder="value"
                className={clsx(termInputCls, "text-zinc-200 flex-1")}
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
