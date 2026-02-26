import { Link } from "wouter"
import { Clock, LogOut } from "lucide-react"
import { useAuthStore } from "@/lib/auth/auth-store"
import { PropsWithChildren } from "react"
import { usePostHog } from "posthog-js/react"

export default function Layout({ children }: PropsWithChildren) {
  const user = useAuthStore(s => s.user)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const posthog = usePostHog()

  function logout() {
    posthog.capture("user_logged_out")
    posthog.reset()
    clearAuth()
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
      <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
        <header className="max-w-5xl mx-auto flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Clock size={18} className="text-emerald-500 dark:text-emerald-400" />
            <span className="text-base font-bold tracking-tight">Tock</span>
          </Link>

          <div className="flex flex-row items-center gap-2">
            <span className="p-0 m-0">{user?.username}</span>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
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
