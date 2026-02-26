import { Client, cacheExchange, fetchExchange } from "urql"
import { authExchange } from "@urql/exchange-auth"
import { env } from "@/env"
import { useAuthStore } from "@/lib/auth/auth-store"

const REFRESH_MUTATION = `
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) { token }
  }
`

export const client = new Client({
  url: env.GRAPHQL_ENDPOINT,
  requestPolicy: "cache-and-network",
  exchanges: [
    cacheExchange,
    authExchange(async utils => {
      let token = useAuthStore.getState().token

      return {
        addAuthToOperation(operation) {
          if (token == null) return operation
          return utils.appendHeaders(operation, { Authorization: `Bearer ${token}` })
        },
        didAuthError(error) {
          return error.graphQLErrors.some(e => e.extensions?.code === "UNAUTHENTICATED")
        },
        async refreshAuth() {
          const refreshToken = useAuthStore.getState().refreshToken
          if (refreshToken == null) {
            token = null
            useAuthStore.getState().clearAuth()
            return
          }

          const res = await fetch(env.GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: REFRESH_MUTATION, variables: { input: { token: refreshToken } } }),
          })
          const body: { data?: { refreshToken?: { token: string } } } = await res.json()
          const newToken = body?.data?.refreshToken?.token
          if (newToken != null) {
            token = newToken
            useAuthStore.getState().setAuth(newToken, refreshToken, useAuthStore.getState().user)
          } else {
            token = null
            useAuthStore.getState().clearAuth()
          }
        },
      }
    }),
    fetchExchange,
  ],
})
