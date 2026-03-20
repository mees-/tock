import { Link, useLocation } from "wouter"
import { Clock, LogOut, CircleUserRound } from "lucide-react"
import { useAuthStore } from "@/lib/auth/auth-store"
import { PropsWithChildren } from "react"
import { usePostHog } from "posthog-js/react"
import { useHotkeys } from "react-hotkeys-hook"

export default function Layout({ children }: PropsWithChildren) {
  const user = useAuthStore(s => s.user)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const posthog = usePostHog()
  const [location, navigate] = useLocation()

  useHotkeys("n", () => navigate("/jobs/new"), {
    enabled: location !== "/jobs/new",
    enableOnFormTags: false,
    enableOnContentEditable: false,
  })

  function logout() {
    posthog.capture("user_logged_out")
    posthog.reset()
    clearAuth()
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <header className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex gap-4 items-center">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Clock
                size={18}
                className="text-emerald-500 dark:text-emerald-400"
              />
              <span className="text-base font-bold tracking-tight">Tock</span>
            </Link>{" "}
            {location !== "/dashboard" && (
              <Link
                href="/dashboard"
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:text-white"
              >
                Dashboard
              </Link>
            )}
          </div>

          <div className="flex flex-row items-center gap-2">
            <Link
              href="/settings/user"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <CircleUserRound size={15} />
              {user?.username}
            </Link>
            <button
              onClick={logout}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>
      </div>
      <main className="mx-auto max-w-5xl px-8 py-8">{children}</main>
    </div>
  )
}
