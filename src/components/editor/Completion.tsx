import { useState } from "react"
import clsx from "clsx"
import type { CompletionProvider, Suggestion } from "@/lib/completions"

type Query = { value: string; caret: number }

/**
 * Editor-style autocomplete for a single-line input: a popup list plus ghost
 * text for the selected suggestion. `accept` writes the completed value.
 */
export function useCompletion(
  provider: CompletionProvider,
  accept: (value: string, caret: number) => void,
) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(0)
  const [query, setQuery] = useState<Query>({ value: "", caret: 0 })

  const result = open ? provider(query.value, query.caret) : null
  const replaced =
    result == null ? "" : query.value.slice(result.from, result.to)
  const items = result?.items.filter(item => item.insert !== replaced) ?? []
  const current = items[Math.min(selected, items.length - 1)]
  const typed =
    result == null ? "" : query.value.slice(result.from, query.caret)
  const showGhost =
    current != null &&
    result != null &&
    query.caret === result.to &&
    result.to === query.value.length &&
    current.insert.toLowerCase().startsWith(typed.toLowerCase())
  const ghost = showGhost ? current.insert.slice(typed.length) : ""

  function read(el: HTMLInputElement): Query {
    return { value: el.value, caret: el.selectionStart ?? el.value.length }
  }

  function pick(item: Suggestion) {
    if (result == null) return
    const value =
      query.value.slice(0, result.from) +
      item.insert +
      query.value.slice(result.to)
    const caret = result.from + item.insert.length
    accept(value, caret)
    setQuery({ value, caret })
    setOpen(item.chain === true)
    setSelected(0)
  }

  const handlers = {
    onInput(e: React.InputEvent<HTMLInputElement>) {
      setQuery(read(e.currentTarget))
      const { inputType } = e.nativeEvent
      if (inputType.startsWith("insert")) {
        setOpen(true)
        setSelected(0)
      }
    },
    onSelect(e: React.SyntheticEvent<HTMLInputElement>) {
      setQuery(read(e.currentTarget))
    },
    onBlur() {
      setOpen(false)
    },
    /** Sets `defaultPrevented` when it handled the key. */
    onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === " " && e.ctrlKey) {
        e.preventDefault()
        setQuery(read(e.currentTarget))
        setOpen(true)
        setSelected(0)
        return
      }
      if (current == null) return
      const plain = !e.metaKey && !e.ctrlKey && !e.altKey
      if (e.key === "ArrowDown" && plain) {
        e.preventDefault()
        setSelected((selected + 1) % items.length)
      } else if (e.key === "ArrowUp" && plain) {
        e.preventDefault()
        setSelected((selected - 1 + items.length) % items.length)
      } else if ((e.key === "Enter" || e.key === "Tab") && plain) {
        e.preventDefault()
        pick(current)
      } else if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
      }
    },
  }

  const popup =
    current != null && result != null ? (
      <ul
        role="listbox"
        className="absolute top-full z-30 mt-1 min-w-48 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        style={{ left: `${result.from}ch` }}
      >
        {items.map((item, i) => (
          <li
            key={item.insert}
            role="option"
            aria-selected={item === current}
            onMouseDown={e => {
              e.preventDefault()
              pick(item)
            }}
            onMouseEnter={() => setSelected(i)}
            className={clsx(
              "flex cursor-pointer items-baseline justify-between gap-6 whitespace-pre px-3",
              item === current
                ? "bg-emerald-50 text-zinc-900 dark:bg-emerald-900/30 dark:text-white"
                : "text-zinc-700 dark:text-zinc-300",
            )}
          >
            <span>{item.insert}</span>
            {item.detail != null && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {item.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
    ) : null

  return { handlers, ghost, popup }
}

export type Completion = ReturnType<typeof useCompletion>
