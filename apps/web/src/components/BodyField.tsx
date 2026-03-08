import clsx from "clsx"
import { termInputCls } from "@/lib/styles"

export function BodyField({
  value,
  show,
  onShow,
  onChange,
}: {
  value: string
  show: boolean
  onShow: (v: boolean) => void
  onChange: (v: string) => void
}) {
  if (show) {
    return (
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/30 px-4 py-3 mt-4">
        <p className="text-xs text-zinc-600 font-mono mb-2"># body</p>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={4}
          placeholder='{"key": "value"}'
          className={clsx(termInputCls, "text-zinc-300 resize-none")}
        />
        <button
          type="button"
          onClick={() => {
            onShow(false)
            onChange("")
          }}
          className="mt-1 text-xs text-red-400 transition-colors hover:text-red-300"
        >
          − remove body
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => onShow(true)}
        className="text-xs text-emerald-500 transition-colors hover:text-emerald-400"
      >
        + add body
      </button>
    </div>
  )
}
