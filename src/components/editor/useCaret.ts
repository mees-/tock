import { useEffect, useState } from "react"

/** Caret position inside a `data-field` element, by line within that field. */
export type Caret = { field: string; line: number; col: number }

function readCaret(root: HTMLElement | null): Caret | null {
  const el = document.activeElement
  const isField =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
  if (!isField || el.dataset.field == null || root?.contains(el) !== true) {
    return null
  }
  const offset = el.selectionStart ?? 0
  const before = el.value.slice(0, offset)
  const lineStart = before.lastIndexOf("\n") + 1
  return {
    field: el.dataset.field,
    line: before.split("\n").length - 1,
    col: offset - lineStart,
  }
}

function sameCaret(a: Caret | null, b: Caret | null) {
  return a?.field === b?.field && a?.line === b?.line && a?.col === b?.col
}

export function useCaret(rootRef: React.RefObject<HTMLElement | null>) {
  const [caret, setCaret] = useState<Caret | null>(null)

  useEffect(() => {
    function update() {
      const next = readCaret(rootRef.current)
      setCaret(prev => (sameCaret(prev, next) ? prev : next))
    }
    // Bubble phase: React must handle `input` first, or this re-render would
    // write the stale controlled value back over the typed text.
    const events = ["selectionchange", "focusin", "focusout", "input"]
    for (const type of events) document.addEventListener(type, update)
    return () => {
      for (const type of events) document.removeEventListener(type, update)
    }
  }, [rootRef])

  return caret
}
