import { useState } from "react"
import { Clock } from "lucide-react"
import { inputCls } from "@/lib/styles"

interface AuthFormProps {
  title: string
  description?: string
  submitLabel: string
  loadingLabel: string
  /** Called with the entered credentials. Return an error string or null on success. */
  onSubmit: (username: string, password: string) => Promise<string | null>
  usernameMinLength?: number
  passwordMinLength?: number
  passwordHint?: string
}

export default function AuthForm({
  title,
  description,
  submitLabel,
  loadingLabel,
  onSubmit,
  usernameMinLength,
  passwordMinLength,
  passwordHint,
}: AuthFormProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await onSubmit(username, password)
    setLoading(false)
    if (err != null) setError(err)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Clock size={28} className="text-emerald-500 dark:text-emerald-400" />
          <span className="text-2xl font-bold text-zinc-900 dark:text-white">tock</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-xl"
        >
          <h1 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">{title}</h1>
          {description != null && <p className="mb-6 text-sm text-zinc-500">{description}</p>}
          {description == null && <div className="mb-6" />}

          {error != null && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                minLength={usernameMinLength}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={passwordMinLength}
                className={inputCls}
              />
              {passwordHint != null && <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">{passwordHint}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {loading ? loadingLabel : submitLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
