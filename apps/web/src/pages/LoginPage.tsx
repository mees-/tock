import { useLocation } from "wouter"
import { useAuthStore } from "@/lib/auth/auth-store"
import AuthForm from "@/components/AuthForm"
import { useMutation } from "urql"
import { graphql } from "@/lib/graphql/graphql"

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

  async function handleSubmit(username: string, password: string): Promise<string | null> {
    const result = await login({ input: { username, password } })
    if (result.error != null) {
      const message = result.error.graphQLErrors[0]?.message ?? result.error.message
      return message ?? "Login failed"
    }
    const data = result.data?.login
    if (data == null) return "Login failed"
    setAuth(data.token, data.refreshToken, data.user)
    navigate("/")
    return null
  }

  return <AuthForm title="Sign in" submitLabel="Sign in" loadingLabel="Signing in…" onSubmit={handleSubmit} />
}
