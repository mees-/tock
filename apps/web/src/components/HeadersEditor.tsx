import clsx from "clsx"
import httpHeaderValidation from "http-headers-validation"
import { useEffect, useImperativeHandle, useRef, useState } from "react"
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

export type HeadersEditorHandle = { enter: () => void }

export function HeadersEditor({
  headers,
  onChange,
  onExitDown,
  onExitUp,
  ref,
}: {
  headers: Header[]
  onChange: (headers: Header[]) => void
  onExitDown?: () => void
  onExitUp?: () => void
  ref?: React.Ref<HeadersEditorHandle>
}) {
  const [rawLines, setRawLines] = useState<string[]>(() =>
    headers.length > 0 ? headers.map(toRaw) : [],
  )
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const containerRef = useRef<HTMLDivElement>(null)
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
    changeRawLines(next)
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      // If current line is empty, exit downward
      if (rawLines[index] === "") {
        // Remove empty trailing line and exit
        if (rawLines.length === 1) {
          changeRawLines([])
        } else {
          changeRawLines(rawLines.filter((_, i) => i !== index))
        }
        onExitDown?.()
        return
      }
      // Otherwise create a new line below
      if (index >= rawLines.length - 1) {
        changeRawLines([...rawLines, ""])
      }
      setShouldFocusLineIndex(index + 1)
    } else if (
      e.key === "Backspace" &&
      rawLines[index] === "" &&
      rawLines.length > 0
    ) {
      e.preventDefault()
      if (rawLines.length === 1) {
        changeRawLines([])
        onExitUp?.()
      } else {
        changeRawLines(rawLines.filter((_, i) => i !== index))
        setShouldFocusLineIndex(Math.max(0, index - 1))
      }
    } else if (e.key === "ArrowUp" && index === 0) {
      e.preventDefault()
      onExitUp?.()
    } else if (e.key === "ArrowDown") {
      if (index >= rawLines.length - 1) {
        e.preventDefault()
        onExitDown?.()
      } else {
        e.preventDefault()
        setShouldFocusLineIndex(index + 1)
      }
    } else if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault()
      setShouldFocusLineIndex(index - 1)
    }
  }

  /** Called when the label area is clicked to enter the headers section */
  function enterHeaders() {
    if (rawLines.length === 0) {
      changeRawLines([""])
      setShouldFocusLineIndex(0)
    } else {
      inputRefs.current[0]?.focus()
    }
  }

  useImperativeHandle(ref, () => ({ enter: enterHeaders }), [rawLines.length])

  const overlayBaseCls =
    "pointer-events-none absolute inset-0 flex items-center font-mono text-sm whitespace-pre px-0 py-0"

  const inputBaseCls = clsx(
    termInputCls,
    "relative w-full bg-transparent text-transparent caret-emerald-400 font-mono text-sm",
  )

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return
    if (rawLines.every(r => r === "")) {
      changeRawLines([])
    }
  }

  return (
    <div ref={containerRef} onBlur={handleContainerBlur}>
      <div
        className="flex items-center gap-2 cursor-text"
        onClick={enterHeaders}
      >
        <span className="shrink-0 cursor-default text-zinc-500">headers:</span>
        {rawLines.length === 0 && (
          <span className="text-zinc-600 text-sm font-mono italic">(none)</span>
        )}
      </div>
      {rawLines.map((raw, i) => {
        const firstEmpty = rawLines.findIndex(r => r === "")
        const showPlaceholder = raw === "" && i === firstEmpty
        return (
          <div key={i} className="flex items-center">
            <div className="relative flex-1 min-w-0">
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
    </div>
  )
}
