import { useRef } from "react"
import { flushSync } from "react-dom"
import clsx from "clsx"
import { looksLikeJson, tokenizeJson, formatJson } from "@/lib/json"
import type { JsonProblem, JsonTokenKind } from "@/lib/json"
import {
  deleteLines,
  deletePair,
  duplicateLines,
  indentLines,
  insertNewline,
  insertPair,
  moveLines,
  skipCloser,
} from "@/lib/textEditing"
import type { TextState } from "@/lib/textEditing"
import { isMacOs } from "@/lib/platform"

const TOKEN_CLASS: Record<JsonTokenKind, string> = {
  key: "text-sky-600 dark:text-sky-300",
  string: "text-amber-600 dark:text-amber-200",
  number: "text-violet-600 dark:text-violet-300",
  literal: "text-emerald-600 dark:text-emerald-400",
  punct: "text-zinc-400 dark:text-zinc-500",
  space: "",
  other: "text-zinc-700 dark:text-zinc-300",
}

const PROBLEM_CLASS = "underline decoration-wavy decoration-amber-500"

function Highlighted({
  text,
  problem,
}: {
  text: string
  problem: JsonProblem | null
}) {
  if (!looksLikeJson(text)) {
    return <span className="text-zinc-700 dark:text-zinc-300">{text}</span>
  }
  const tokens = tokenizeJson(text)
  const lastVisible = tokens.reduce(
    (last, t, i) => (t.kind === "space" ? last : i),
    -1,
  )
  const problemIndex =
    problem == null
      ? -1
      : problem.offset >= text.length
        ? lastVisible
        : tokens.findIndex(
            t =>
              problem.offset >= t.offset &&
              problem.offset < t.offset + t.text.length,
          )
  return tokens.map((token, i) => (
    <span
      key={token.offset}
      className={clsx(
        TOKEN_CLASS[token.kind],
        i === problemIndex && PROBLEM_CLASS,
      )}
    >
      {token.text}
    </span>
  ))
}

/**
 * Multi-line body with JSON highlighting and code-editor keys: auto-indent,
 * Tab/Shift+Tab, bracket and quote pairs, line moves and ⇧⌥F to format.
 */
export function BodyEditor({
  value,
  onChange,
  onSeal,
  onExitUp,
  problem,
  ref,
}: {
  value: string
  onChange: (value: string) => void
  /** Marks an undo-step boundary around structural edits. */
  onSeal: () => void
  onExitUp: () => void
  problem: JsonProblem | null
  ref?: React.Ref<HTMLTextAreaElement>
}) {
  const overlayRef = useRef<HTMLPreElement>(null)
  // After Escape, Tab leaves the editor instead of indenting.
  const tabLeaves = useRef(false)

  function apply(el: HTMLTextAreaElement, next: TextState, seal: boolean) {
    if (seal) onSeal()
    flushSync(() => onChange(next.value))
    el.setSelectionRange(next.start, next.end)
    if (seal) onSeal()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget
    const state = {
      value: el.value,
      start: el.selectionStart,
      end: el.selectionEnd,
    }
    const mod = isMacOs ? e.metaKey : e.ctrlKey
    const plain = !mod && !e.altKey && !e.ctrlKey && !e.metaKey
    const leaving = tabLeaves.current
    tabLeaves.current = e.key === "Escape"

    let next: TextState | null = null
    let structural = false

    if (e.key === "Tab" && plain) {
      if (leaving) return
      next = indentLines(state, e.shiftKey)
    } else if (e.key === "Enter" && plain && !e.shiftKey) {
      next = insertNewline(state)
    } else if (e.altKey && e.shiftKey && e.code === "KeyF") {
      e.preventDefault()
      const formatted = formatJson(state.value)
      if (formatted != null) {
        next = { value: formatted, start: 0, end: 0 }
        structural = true
      }
    } else if (
      e.altKey &&
      !mod &&
      (e.key === "ArrowUp" || e.key === "ArrowDown")
    ) {
      e.preventDefault()
      const direction = e.key === "ArrowUp" ? -1 : 1
      next = e.shiftKey
        ? duplicateLines(state, direction)
        : moveLines(state, direction)
      structural = true
    } else if (mod && e.shiftKey && e.code === "KeyK") {
      next = deleteLines(state)
      structural = true
    } else if (e.key === "Backspace" && plain) {
      next = deletePair(state)
    } else if (e.key.length === 1 && plain) {
      next = skipCloser(state, e.key) ?? insertPair(state, e.key)
    } else if (
      e.key === "ArrowUp" &&
      plain &&
      !e.shiftKey &&
      !state.value.slice(0, state.start).includes("\n")
    ) {
      e.preventDefault()
      onExitUp()
      return
    }

    if (next == null) return
    e.preventDefault()
    apply(el, next, structural)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <pre
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre font-mono text-sm leading-6"
      >
        <Highlighted text={value} problem={problem} />
      </pre>
      <textarea
        ref={ref}
        data-field="body"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={e => {
          if (overlayRef.current != null) {
            overlayRef.current.scrollLeft = e.currentTarget.scrollLeft
          }
        }}
        rows={Math.max(1, value.split("\n").length)}
        wrap="off"
        placeholder='{"key": "value"}'
        spellCheck={false}
        autoComplete="off"
        className={clsx(
          "relative block w-full resize-none overflow-x-auto overflow-y-hidden border-none bg-transparent p-0 font-mono text-sm leading-6 text-transparent outline-none",
          "caret-emerald-500 placeholder:text-zinc-400 selection:bg-emerald-200/60 dark:caret-emerald-400 dark:placeholder:text-zinc-600 dark:selection:bg-emerald-900/40",
        )}
      />
    </div>
  )
}
