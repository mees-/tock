/** Editor operations on a text value and its selection, as pure functions. */
export type TextState = { value: string; start: number; end: number }

export const INDENT = "  "

const PAIRS: Record<string, string> = { "{": "}", "[": "]", '"': '"' }
const CLOSERS = new Set(["}", "]", '"'])
const WORD_CHAR = /[\w\\]/

function lineStartAt(value: string, pos: number) {
  return value.lastIndexOf("\n", pos - 1) + 1
}

function lineEndAt(value: string, pos: number) {
  const end = value.indexOf("\n", pos)
  return end === -1 ? value.length : end
}

/** Start and end of the full lines the selection touches. */
function selectedLines({ value, start, end }: TextState) {
  // A selection ending at the start of a line doesn't include that line.
  const lastPos = end > start && value[end - 1] === "\n" ? end - 1 : end
  return { from: lineStartAt(value, start), to: lineEndAt(value, lastPos) }
}

function leadingWhitespace(line: string) {
  return /^[ \t]*/.exec(line)?.[0] ?? ""
}

function replace(state: TextState, from: number, to: number, text: string) {
  const value = state.value.slice(0, from) + text + state.value.slice(to)
  const caret = from + text.length
  return { value, start: caret, end: caret }
}

export function insertNewline(state: TextState): TextState {
  const { value, start, end } = state
  const indent = leadingWhitespace(
    value.slice(lineStartAt(value, start), start),
  )
  const before = value[start - 1]
  const after = value[end]
  if (before !== "{" && before !== "[")
    return replace(state, start, end, `\n${indent}`)

  const inner = `\n${indent}${INDENT}`
  if (after !== PAIRS[before]) return replace(state, start, end, inner)
  const caret = start + inner.length
  return {
    value: value.slice(0, start) + inner + `\n${indent}` + value.slice(end),
    start: caret,
    end: caret,
  }
}

export function indentLines(state: TextState, outdent: boolean): TextState {
  const { value, start, end } = state
  const singleCaret = start === end
  if (singleCaret && !outdent) return replace(state, start, end, INDENT)

  const { from, to } = selectedLines(state)
  const lines = value.slice(from, to).split("\n")
  let firstLineShift = 0
  let totalShift = 0
  const next = lines.map((line, i) => {
    if (outdent) {
      const removed = Math.min(leadingWhitespace(line).length, INDENT.length)
      if (i === 0) firstLineShift = -removed
      totalShift -= removed
      return line.slice(removed)
    }
    if (i === 0) firstLineShift = INDENT.length
    totalShift += INDENT.length
    return INDENT + line
  })
  return {
    value: value.slice(0, from) + next.join("\n") + value.slice(to),
    start:
      start === from && !singleCaret
        ? from
        : Math.max(from, start + firstLineShift),
    end: singleCaret
      ? Math.max(from, start + firstLineShift)
      : end + totalShift,
  }
}

/** Typing an opening bracket or quote also inserts its closer. */
export function insertPair(state: TextState, char: string): TextState | null {
  const close = PAIRS[char]
  if (close == null) return null
  const { value, start, end } = state
  if (start !== end) {
    const wrapped = char + value.slice(start, end) + close
    return {
      value: value.slice(0, start) + wrapped + value.slice(end),
      start: start + 1,
      end: end + 1,
    }
  }
  const after = value[end]
  const nextIsOpen =
    after == null || /\s/.test(after) || CLOSERS.has(after) || after === ","
  if (!nextIsOpen) return null
  if (char === '"' && WORD_CHAR.test(value[start - 1] ?? "")) return null
  return {
    value: value.slice(0, start) + char + close + value.slice(end),
    start: start + 1,
    end: start + 1,
  }
}

/** Typing a closer right before the same closer steps over it. */
export function skipCloser(state: TextState, char: string): TextState | null {
  const { value, start, end } = state
  if (start !== end || !CLOSERS.has(char) || value[start] !== char) return null
  return { value, start: start + 1, end: start + 1 }
}

/** Backspace inside an empty pair removes both halves. */
export function deletePair(state: TextState): TextState | null {
  const { value, start, end } = state
  if (start !== end || start === 0) return null
  const open = value[start - 1]
  if (PAIRS[open] == null || value[start] !== PAIRS[open]) return null
  return {
    value: value.slice(0, start - 1) + value.slice(start + 1),
    start: start - 1,
    end: start - 1,
  }
}

export function moveLines(
  state: TextState,
  direction: 1 | -1,
): TextState | null {
  const { value, start, end } = state
  const { from, to } = selectedLines(state)
  const block = value.slice(from, to)
  if (direction === -1) {
    if (from === 0) return null
    const prevFrom = lineStartAt(value, from - 1)
    const prev = value.slice(prevFrom, from - 1)
    const shift = -(prev.length + 1)
    return {
      value: value.slice(0, prevFrom) + block + "\n" + prev + value.slice(to),
      start: start + shift,
      end: end + shift,
    }
  }
  if (to === value.length) return null
  const nextTo = lineEndAt(value, to + 1)
  const next = value.slice(to + 1, nextTo)
  const shift = next.length + 1
  return {
    value: value.slice(0, from) + next + "\n" + block + value.slice(nextTo),
    start: start + shift,
    end: end + shift,
  }
}

export function duplicateLines(state: TextState, direction: 1 | -1): TextState {
  const { value, start, end } = state
  const { from, to } = selectedLines(state)
  const block = value.slice(from, to)
  const shift = direction === 1 ? block.length + 1 : 0
  return {
    value: value.slice(0, to) + "\n" + block + value.slice(to),
    start: start + shift,
    end: end + shift,
  }
}

export function deleteLines(state: TextState): TextState {
  const { value } = state
  const { from, to } = selectedLines(state)
  const cutFrom = to === value.length ? Math.max(0, from - 1) : from
  const cutTo = to === value.length ? to : to + 1
  const next = value.slice(0, cutFrom) + value.slice(cutTo)
  const caret = Math.min(from, next.length)
  return { value: next, start: caret, end: caret }
}
