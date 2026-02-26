import { useLocation } from "wouter"
import { useAuthStore } from "@/lib/auth/auth-store"
import AuthForm from "@/components/AuthForm"
import { useMutation } from "urql"
import { graphql } from "@/lib/graphql/graphql"
import { usePostHog } from "posthog-js/react"

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

  async function handleSubmit(username: string, password: string): Promise<string | null> {
    const result = await login({ input: { username, password } })
    if (result.error != null) {
      const message = result.error.graphQLErrors[0]?.message ?? result.error.message
      return message ?? "Login failed"
    }
    const data = result.data?.login
    if (data == null) return "Login failed"
    setAuth(data.token, data.refreshToken, data.user)
    posthog.identify(data.user.id.toString(), { username: data.user.username, role: data.user.role })
    posthog.capture("user_logged_in", { username: data.user.username })
    navigate("/")
    return null
  }

  return <AuthForm title="Sign in" submitLabel="Sign in" loadingLabel="Signing in…" onSubmit={handleSubmit} />
}
