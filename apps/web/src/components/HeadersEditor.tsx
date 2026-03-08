import clsx from "clsx"
import httpHeaderValidation from "http-headers-validation"
import { useEffect, useRef, useState } from "react"
import { termInputCls } from "@/lib/styles"

export type Header = { key: string; value: string }

const HEADER_PLACEHOLDERS = [
  "Accept: audio/woof",
  "X-Forwarded-For: 47.179.21.34",
  "Cache-Control: no-store",
  "Etag: do-you-know-me",
  "Authorization: Basic d2lubmllOnRoZXBvb2g=",
]

function parseHeaderLine(raw: string): Header {
  const idx = raw.indexOf(":")
  if (idx === -1) return { key: raw.trimEnd(), value: "" }
  return { key: raw.slice(0, idx).trimEnd(), value: raw.slice(idx + 1).trim() }
}

function toRaw(header: Header): string {
  if (!header.key && !header.value) return ""
  if (!header.value) return header.key
  return `${header.key}: ${header.value}`
}

function HeaderOverlay({ raw }: { raw: string }) {
  const idx = raw.indexOf(":")
  const { key, value } = parseHeaderLine(raw)
  const isNameValid = key === "" || httpHeaderValidation.validateHeaderName(key)
  const isValueValid =
    value === "" || httpHeaderValidation.validateHeaderValue(value)
  if (idx === -1) {
    return (
      <span
        className={
          isNameValid
            ? "text-sky-600 dark:text-sky-300"
            : "text-red-500 dark:text-red-400"
        }
      >
        {raw}
      </span>
    )
  }
  return (
    <>
      <span
        className={
          isNameValid
            ? "text-sky-600 dark:text-sky-300"
            : "text-red-500 dark:text-red-400"
        }
      >
        {raw.slice(0, idx)}
      </span>
      <span className="text-zinc-600">:</span>
      <span
        className={
          isValueValid
            ? "text-amber-600 dark:text-amber-200"
            : "text-red-500 dark:text-red-400"
        }
      >
        {raw.slice(idx + 1)}
      </span>
    </>
  )
}

export function HeadersEditor({
  headers,
  onChange,
}: {
  headers: Header[]
  onChange: (headers: Header[]) => void
}) {
  // Raw strings are the source of truth for the inputs.
  // Parsed values are only derived for the overlay and for calling onChange.
  const [rawLines, setRawLines] = useState<string[]>(() => headers.map(toRaw))
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const [shouldFocusLineIndex, setShouldFocusLineIndex] = useState<
    number | null
  >(null)

  const changeRawLines = (newValue: string[]) => {
    setRawLines(newValue)
    onChange(newValue.map(parseHeaderLine))
  }

  useEffect(() => {
    if (
      shouldFocusLineIndex != null &&
      shouldFocusLineIndex < rawLines.length
    ) {
      inputRefs.current[shouldFocusLineIndex]?.focus()
      setShouldFocusLineIndex(null)
    }
  }, [shouldFocusLineIndex, rawLines.length])

  function updateLine(index: number, raw: string) {
    const next = rawLines.map((r, i) => (i === index ? raw : r))
    setRawLines(next)
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (index >= rawLines.length - 1) {
        const newRawLines = [...rawLines, ""]
        changeRawLines(newRawLines)
      }

      setShouldFocusLineIndex(index + 1)
    } else if (
      e.key === "Backspace" &&
      rawLines[index] === "" &&
      rawLines.length > 1
    ) {
      e.preventDefault()
      const next = rawLines.filter((_, i) => i !== index)
      changeRawLines(next)
      setShouldFocusLineIndex(index - 1)
    }
  }

  function addRow() {
    const next = [...rawLines, ""]
    changeRawLines(next)
    setShouldFocusLineIndex(next.length - 1)
  }

  const overlayBaseCls =
    "pointer-events-none absolute inset-0 flex items-center font-mono text-sm whitespace-pre px-0 py-0"

  const inputBaseCls = clsx(
    termInputCls,
    "relative w-full bg-transparent text-transparent caret-emerald-400 font-mono text-sm",
  )

  return (
    <div>
      <div className="space-y-1">
        {rawLines.map((raw, i) => {
          const firstEmpty = rawLines.findIndex(r => r === "")
          const showPlaceholder = raw === "" && i === firstEmpty
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className={overlayBaseCls} aria-hidden>
                  {showPlaceholder ? (
                    <span className="text-zinc-600">
                      {HEADER_PLACEHOLDERS[i % HEADER_PLACEHOLDERS.length]}
                    </span>
                  ) : (
                    <HeaderOverlay raw={raw} />
                  )}
                </div>
                <input
                  ref={el => {
                    inputRefs.current[i] = el
                  }}
                  type="text"
                  list="header-names-edit"
                  value={raw}
                  onChange={e => updateLine(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className={inputBaseCls}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            </div>
          )
        })}

        <button
          type="button"
          onClick={addRow}
          className="cursor-pointer text-xs text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-500 dark:hover:text-emerald-400"
        >
          + add header
        </button>
      </div>
    </div>
  )
}
