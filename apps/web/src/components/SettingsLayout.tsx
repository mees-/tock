import { Link, useRoute } from "wouter"
import { PropsWithChildren } from "react"

export default function SettingsLayout({ children }: PropsWithChildren) {
  const [onUser] = useRoute("/settings/user")
  const [onBilling] = useRoute("/settings/billing")

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Settings
        </h1>
      </div>

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-6">
        <Link
          href="/settings/user"
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            onUser
              ? "border-emerald-500 text-zinc-900 dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          Account
        </Link>
        <Link
          href="/settings/billing"
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            onBilling
              ? "border-emerald-500 text-zinc-900 dark:text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          Billing
        </Link>
      </div>

      {children}
    </div>
  )
}
