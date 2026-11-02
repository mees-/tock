import { useState } from "react"
import { useLocation } from "wouter"
import { Clock } from "lucide-react"
import { useAuthStore } from "@/lib/auth/auth-store"
import { useQuery, useMutation } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import { usePostHog } from "posthog-js/react"
import { inputCls } from "@/lib/styles"
import { Link } from "wouter"
import { useCanSignup } from "@/lib/auth/canSignupHook"

const REGISTER_MUTATION = graphql(`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      refreshToken
      user {
        id
        username
        role
      }
    }
  }
`)

export default function SetupPage() {
  const [, navigate] = useLocation()
  const setAuth = useAuthStore(s => s.setAuth)
  const canSignup = useCanSignup()
  const [, register] = useMutation(REGISTER_MUTATION)
  const posthog = usePostHog()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await register({ input: { username, password } })
    setLoading(false)
    if (result.error != null) {
      const message =
        result.error.graphQLErrors[0]?.message ?? result.error.message
      setError(message ?? "Setup failed")
      return
    }
    const data = result.data?.register
    if (data == null) {
      setError("Setup failed")
      return
    }
    setAuth(data.token, data.refreshToken, data.user)
    posthog.identify(data.user.id.toString(), {
      username: data.user.username,
      role: data.user.role,
    })
    posthog.capture("admin_setup_completed", { username: data.user.username })
    navigate("/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Clock size={28} className="text-emerald-500 dark:text-emerald-400" />
          <span className="text-2xl font-bold text-zinc-900 dark:text-white">
            tock
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-xl"
        >
          <h1 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-white">
            Create admin account
          </h1>
          {canSignup === false && (
            <p className="mb-6 text-sm text-red-600 font-bold">
              Signup has been disabled.
            </p>
          )}
          {canSignup === true && (
            <p className="mb-6 text-sm text-zinc-500">
              This is a one-time setup. Set up your admin credentials.
            </p>
          )}

          {error != null && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                disabled={canSignup === false}
                autoFocus
                minLength={3}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={canSignup === false}
                minLength={8}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
                Minimum 8 characters
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || canSignup === false}
            className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account…" : "Create admin account"}
          </button>
          <p className="mt-4 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
