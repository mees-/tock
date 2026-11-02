import clsx from "clsx"
import httpHeaderValidation from "http-headers-validation"
import { useEffect, useImperativeHandle, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { termInputCls } from "@/lib/styles"
import { completeHeader } from "@/lib/completions"
import { isMacOs } from "@/lib/platform"
import { EditorLine } from "./editor/EditorLine"
import { useCompletion } from "./editor/Completion"

export type Header = { key: string; value: string }

/** Header lines as typed, e.g. `Accept: text/html`. */
export type HeaderLines = string[]

const HEADER_PLACEHOLDERS = [
  "Accept: audio/woof",
  "X-Forwarded-For: 47.179.21.34",
  "Cache-Control: no-store",
  "Etag: do-you-know-me",
  "Authorization: Basic d2lubmllOnRoZXBvb2g=",
]

export function parseHeaderLine(raw: string): Header {
  const idx = raw.indexOf(":")
  if (idx === -1) return { key: raw.trimEnd(), value: "" }
  return { key: raw.slice(0, idx).trimEnd(), value: raw.slice(idx + 1).trim() }
}

export function toHeaderLine(header: Header): string {
  if (!header.key && !header.value) return ""
  if (!header.value) return header.key
  return `${header.key}: ${header.value}`
}

function validity(raw: string) {
  const { key, value } = parseHeaderLine(raw)
  return {
    isNameValid: key === "" || httpHeaderValidation.validateHeaderName(key),
    isValueValid:
      value === "" || httpHeaderValidation.validateHeaderValue(value),
  }
}

export function isHeaderLineValid(raw: string) {
  const { isNameValid, isValueValid } = validity(raw)
  return isNameValid && isValueValid
}

function HeaderOverlay({ raw }: { raw: string }) {
  const idx = raw.indexOf(":")
  const { isNameValid, isValueValid } = validity(raw)
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

export type HeadersEditorHandle = {
  /** Focus the first or last line, creating one when there are none. */
  enter: (position?: "first" | "last") => void
  /** Append an empty line and focus it. */
  add: () => void
}

type FocusRequest = { index: number; caret?: number }

export function HeadersEditor({
  lines: rawLines,
  onChange: changeRawLines,
  onSeal,
  onExitDown,
  onExitUp,
  firstLine,
  cursorField,
  ref,
}: {
  lines: HeaderLines
  onChange: (lines: HeaderLines) => void
  /** Marks an undo-step boundary around structural edits. */
  onSeal: () => void
  onExitDown?: () => void
  onExitUp?: () => void
  /** Line number of the `headers:` label. */
  firstLine: number
  cursorField: string | null
  ref?: React.Ref<HeadersEditorHandle>
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const [completionLine, setCompletionLine] = useState<number | null>(null)

  const completion = useCompletion(completeHeader, (raw, caret) => {
    if (completionLine == null) return
    onSeal()
    flushSync(() => updateLine(completionLine, raw))
    inputRefs.current[completionLine]?.setSelectionRange(caret, caret)
    onSeal()
  })

  useEffect(() => {
    if (focusRequest == null || focusRequest.index >= rawLines.length) return
    const input = inputRefs.current[focusRequest.index]
    input?.focus()
    if (focusRequest.caret != null) {
      input?.setSelectionRange(focusRequest.caret, focusRequest.caret)
    }
    setFocusRequest(null)
  }, [focusRequest, rawLines])

  function updateLine(index: number, raw: string) {
    const next = rawLines.map((r, i) => (i === index ? raw : r))
    changeRawLines(next)
  }

  function structuralEdit(next: HeaderLines, focus: FocusRequest | null) {
    onSeal()
    flushSync(() => changeRawLines(next))
    onSeal()
    if (focus != null) setFocusRequest(focus)
  }

  /** ⌥↑/↓ moves, ⇧⌥↑/↓ duplicates and ⌘⇧K deletes the line. */
  function handleLineCommand(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    const caret = e.currentTarget.selectionStart ?? undefined
    const mod = isMacOs ? e.metaKey : e.ctrlKey
    const vertical = e.key === "ArrowUp" || e.key === "ArrowDown"
    if (e.altKey && !mod && vertical) {
      e.preventDefault()
      const direction = e.key === "ArrowUp" ? -1 : 1
      if (e.shiftKey) {
        const next = [...rawLines]
        next.splice(index + 1, 0, rawLines[index])
        structuralEdit(next, {
          index: direction === 1 ? index + 1 : index,
          caret,
        })
        return
      }
      const target = index + direction
      if (target < 0 || target >= rawLines.length) return
      const next = [...rawLines]
      next[index] = rawLines[target]
      next[target] = rawLines[index]
      structuralEdit(next, { index: target, caret })
    } else if (mod && e.shiftKey && e.code === "KeyK") {
      e.preventDefault()
      const next = rawLines.filter((_, i) => i !== index)
      if (next.length === 0) {
        structuralEdit(next, null)
        onExitUp?.()
        return
      }
      structuralEdit(next, { index: Math.min(index, next.length - 1) })
    }
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    completion.handlers.onKeyDown(e)
    if (e.defaultPrevented) return
    handleLineCommand(index, e)
    if (e.defaultPrevented) return

    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      // If current line is empty, exit downward
      if (rawLines[index] === "") {
        changeRawLines(rawLines.filter((_, i) => i !== index))
        onExitDown?.()
        return
      }
      // Otherwise create a new line below
      if (index >= rawLines.length - 1) {
        changeRawLines([...rawLines, ""])
      }
      setFocusRequest({ index: index + 1 })
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
        setFocusRequest({ index: Math.max(0, index - 1) })
      }
    } else if (e.key === "ArrowUp" && index === 0) {
      e.preventDefault()
      onExitUp?.()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (index >= rawLines.length - 1) {
        onExitDown?.()
      } else {
        setFocusRequest({ index: index + 1 })
      }
    } else if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault()
      setFocusRequest({ index: index - 1 })
    }
  }

  function enterHeaders(position: "first" | "last" = "first") {
    if (rawLines.length === 0) {
      changeRawLines([""])
      setFocusRequest({ index: 0 })
    } else {
      const index = position === "first" ? 0 : rawLines.length - 1
      inputRefs.current[index]?.focus()
    }
  }

  function addLine() {
    changeRawLines([...rawLines, ""])
    setFocusRequest({ index: rawLines.length })
  }

  useImperativeHandle(ref, () => ({ enter: enterHeaders, add: addLine }), [
    rawLines,
  ])

  const overlayBaseCls =
    "pointer-events-none absolute inset-0 flex items-center font-mono text-sm whitespace-pre px-0 py-0"

  const inputBaseCls = clsx(
    termInputCls,
    "relative h-6 w-full bg-transparent text-transparent caret-emerald-400 font-mono text-sm",
  )

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return
    if (rawLines.length > 0 && rawLines.every(r => r === "")) {
      changeRawLines([])
    }
  }

  const firstEmpty = rawLines.findIndex(r => r === "")

  return (
    <div ref={containerRef} onBlur={handleContainerBlur}>
      <EditorLine
        number={firstLine}
        className="cursor-text"
        onClick={() => enterHeaders()}
      >
        <span className="cursor-default text-zinc-500">headers:</span>
        {rawLines.length === 0 && (
          <span className="ml-2 font-mono text-sm italic text-zinc-600">
            (none)
          </span>
        )}
      </EditorLine>
      {rawLines.map((raw, i) => {
        const showPlaceholder = raw === "" && i === firstEmpty
        const completing = completionLine === i
        return (
          <EditorLine
            key={i}
            number={firstLine + 1 + i}
            activeLine={cursorField === `headers.${i}` ? 0 : null}
            problemLines={isHeaderLineValid(raw) ? [] : [0]}
          >
            <div className="relative ml-[2ch] h-6">
              <div className={overlayBaseCls} aria-hidden>
                {showPlaceholder && !(completing && completion.ghost !== "") ? (
                  <span className="text-zinc-600">
                    {HEADER_PLACEHOLDERS[i % HEADER_PLACEHOLDERS.length]}
                  </span>
                ) : (
                  <HeaderOverlay raw={raw} />
                )}
                {completing && (
                  <span className="text-zinc-400 dark:text-zinc-600">
                    {completion.ghost}
                  </span>
                )}
              </div>
              <input
                ref={el => {
                  inputRefs.current[i] = el
                }}
                type="text"
                data-field={`headers.${i}`}
                value={raw}
                onChange={e => updateLine(i, e.target.value)}
                onInput={completion.handlers.onInput}
                onSelect={completion.handlers.onSelect}
                onFocus={() => setCompletionLine(i)}
                onBlur={completion.handlers.onBlur}
                onKeyDown={e => handleKeyDown(i, e)}
                className={inputBaseCls}
                spellCheck={false}
                autoComplete="off"
              />
              {completing && completion.popup}
            </div>
          </EditorLine>
        )
      })}
    </div>
  )
}
