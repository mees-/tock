import { useState } from "react"
import { useMutation } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import { useAuthStore } from "@/lib/auth/auth-store"
import SettingsLayout from "@/components/SettingsLayout"

const ChangePasswordMutation = graphql(`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(
      input: { currentPassword: $currentPassword, newPassword: $newPassword }
    )
  }
`)

export default function UserSettingsPage() {
  const user = useAuthStore(s => s.user)
  const [, changePassword] = useMutation(ChangePasswordMutation)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)

    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", message: "New passwords do not match" })
      return
    }

    setSubmitting(true)
    const result = await changePassword({ currentPassword, newPassword })
    setSubmitting(false)

    if (result.error != null) {
      setStatus({
        type: "error",
        message: result.error.graphQLErrors[0]?.message ?? result.error.message,
      })
    } else {
      setStatus({ type: "success", message: "Password updated successfully" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    }
  }

  return (
    <SettingsLayout>
      <div className="space-y-6 max-w-md">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Username
          </p>
          <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">
            {user?.username}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">
            Change password
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Confirm new password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </div>

            {status != null && (
              <p
                className={`text-sm ${status.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
              >
                {status.message}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {submitting ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </SettingsLayout>
  )
}
