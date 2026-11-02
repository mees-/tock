import { useCallback, useMemo, useRef } from "react"

/** Keystrokes in the same field closer together than this undo as one step. */
const COALESCE_MS = 1_000
const MAX_ENTRIES = 500

type Entry<T> = { values: T; field: string | null }

type Apply<T> = (values: T, field: string | null) => void

function isEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Editor-style undo/redo over whole-form snapshots. `field` names where an
 * edit happened, so `apply` can put the caret back there.
 */
export function useEditHistory<T>(initial: T, apply: Apply<T>) {
  const entries = useRef<Entry<T>[]>([{ values: initial, field: null }])
  const index = useRef(0)
  const lastRecordAt = useRef(0)
  const applying = useRef(false)
  const applyRef = useRef(apply)
  applyRef.current = apply

  const record = useCallback(
    (values: T, field: string | null, { coalesce = true } = {}) => {
      if (applying.current) return
      const list = entries.current
      const current = list[index.current]
      if (isEqual(values, current.values)) return

      list.length = index.current + 1
      const now = Date.now()
      const previous = list[index.current - 1]

      // An edit outside any field that restores the previous state (e.g. an
      // empty header line dropped on blur) cancels out rather than piling up.
      if (
        field == null &&
        previous != null &&
        isEqual(values, previous.values)
      ) {
        list.pop()
        index.current--
        lastRecordAt.current = 0
        return
      }

      const canCoalesce =
        coalesce &&
        index.current > 0 &&
        field != null &&
        // A field-less edit (opening an empty header line) joins the typing that follows.
        (field === current.field || current.field == null) &&
        now - lastRecordAt.current < COALESCE_MS
      lastRecordAt.current = now

      if (canCoalesce) {
        list[index.current] = { values, field }
        return
      }
      list.push({ values, field })
      if (list.length > MAX_ENTRIES) list.shift()
      index.current = list.length - 1
    },
    [],
  )

  const step = useCallback((direction: 1 | -1) => {
    const target = entries.current[index.current + direction]
    if (target == null) return
    const field =
      direction === -1 ? entries.current[index.current].field : target.field
    index.current += direction
    lastRecordAt.current = 0
    applying.current = true
    try {
      applyRef.current(target.values, field)
    } finally {
      applying.current = false
    }
  }, [])

  return useMemo(
    () => ({
      record,
      undo: () => step(-1),
      redo: () => step(1),
      /** Make the next edit its own undo step. */
      seal: () => {
        lastRecordAt.current = 0
      },
    }),
    [record, step],
  )
}
