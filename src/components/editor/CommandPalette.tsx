import { useState } from "react"
import { createPortal } from "react-dom"
import clsx from "clsx"

export type Command = {
  id: string
  label: string
  shortcut?: string
  run: () => void
}

function matches(label: string, query: string) {
  const haystack = label.toLowerCase()
  let from = 0
  for (const char of query.toLowerCase().replace(/\s+/g, "")) {
    from = haystack.indexOf(char, from) + 1
    if (from === 0) return false
  }
  return true
}

/** `onClose` runs before the chosen command, so focus can be restored first. */
export function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[]
  onClose: () => void
}) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const filtered = commands.filter(c => matches(c.label, query))
  const current = filtered[Math.min(selected, filtered.length - 1)]

  function run(command: Command) {
    onClose()
    command.run()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    } else if (e.key === "ArrowDown" && filtered.length > 0) {
      e.preventDefault()
      setSelected((selected + 1) % filtered.length)
    } else if (e.key === "ArrowUp" && filtered.length > 0) {
      e.preventDefault()
      setSelected((selected - 1 + filtered.length) % filtered.length)
    } else if (e.key === "Enter" && current != null) {
      e.preventDefault()
      run(current)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/20 px-4 pt-[15vh] dark:bg-black/40"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="h-fit w-full max-w-lg overflow-hidden rounded-lg border border-zinc-200 bg-white font-mono text-sm shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <input
          autoFocus
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a command…"
          spellCheck={false}
          autoComplete="off"
          className="w-full border-b border-zinc-200 bg-transparent px-4 py-3 text-zinc-900 outline-none placeholder:text-zinc-400 dark:border-zinc-800 dark:text-white"
        />
        <ul role="listbox" className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-2 text-zinc-400">No matching commands</li>
          )}
          {filtered.map((command, i) => (
            <li
              key={command.id}
              role="option"
              aria-selected={command === current}
              onMouseEnter={() => setSelected(i)}
              onMouseDown={e => {
                e.preventDefault()
                run(command)
              }}
              className={clsx(
                "flex cursor-pointer items-center justify-between gap-4 px-4 py-1.5",
                command === current
                  ? "bg-emerald-50 text-zinc-900 dark:bg-emerald-900/30 dark:text-white"
                  : "text-zinc-700 dark:text-zinc-300",
              )}
            >
              <span>{command.label}</span>
              {command.shortcut != null && (
                <kbd className="text-xs text-zinc-400 dark:text-zinc-500">
                  {command.shortcut}
                </kbd>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
