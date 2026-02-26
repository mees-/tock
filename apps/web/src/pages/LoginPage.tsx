import { useState } from "react"
import { useLocation, Link } from "wouter"
import { Clock } from "lucide-react"
import { useAuthStore } from "@/lib/auth/auth-store"
import { useMutation, useQuery } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import { usePostHog } from "posthog-js/react"
import { inputCls } from "@/lib/styles"
import { useCanSignup } from "@/lib/auth/canSignupHook"

const LOGIN_MUTATION = graphql(`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
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

export default function LoginPage() {
  const [, navigate] = useLocation()
  const setAuth = useAuthStore(s => s.setAuth)
  const [, login] = useMutation(LOGIN_MUTATION)
  const posthog = usePostHog()
  const canSignup = useCanSignup()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await login({ input: { username, password } })
    setLoading(false)
    if (result.error != null) {
      const message =
        result.error.graphQLErrors[0]?.message ?? result.error.message
      setError(message ?? "Login failed")
      return
    }
    const data = result.data?.login
    if (data == null) {
      setError("Login failed")
      return
    }
    setAuth(data.token, data.refreshToken, data.user)
    posthog.identify(data.user.id.toString(), {
      username: data.user.username,
      role: data.user.role,
    })
    posthog.capture("user_logged_in", { username: data.user.username })
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
          <h1 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-white">
            Sign in
          </h1>

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
                autoFocus
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
                className={inputCls}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          {canSignup === true && (
            <p className="mt-4 text-center text-sm text-zinc-500">
              No account yet?{" "}
              <Link
                href="/setup"
                className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
              >
                Create one
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
