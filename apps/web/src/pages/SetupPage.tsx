import { useLocation } from "wouter"
import { useAuthStore } from "@/lib/auth/auth-store"
import AuthForm from "@/components/AuthForm"
import { useMutation } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import { usePostHog } from "posthog-js/react"

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
  const [, register] = useMutation(REGISTER_MUTATION)
  const posthog = usePostHog()

  async function handleSubmit(
    username: string,
    password: string,
  ): Promise<string | null> {
    const result = await register({ input: { username, password } })
    if (result.error != null) {
      const message =
        result.error.graphQLErrors[0]?.message ?? result.error.message
      return message ?? "Setup failed"
    }
    const data = result.data?.register
    if (data == null) return "Setup failed"
    setAuth(data.token, data.refreshToken, data.user)
    posthog.identify(data.user.id.toString(), {
      username: data.user.username,
      role: data.user.role,
    })
    posthog.capture("admin_setup_completed", { username: data.user.username })
    navigate("/")
    return null
  }

  return (
    <AuthForm
      title="Create admin account"
      description="This is a one-time setup. Set up your admin credentials."
      submitLabel="Create admin account"
      loadingLabel="Creating account…"
      usernameMinLength={3}
      passwordMinLength={8}
      passwordHint="Minimum 8 characters"
      onSubmit={handleSubmit}
    />
  )
}
