import { Client, cacheExchange, fetchExchange } from "urql"
import { authExchange } from "@urql/exchange-auth"
import { env } from "@/env"
import { useAuthStore } from "@/lib/auth/auth-store"

const REFRESH_MUTATION = `
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) {
      token
      refreshToken
      user { id username role }
    }
  }
`

type RefreshPayload = {
  token: string
  refreshToken: string
  user: { id: number; username: string; role: string }
}

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
          return utils.appendHeaders(operation, {
            Authorization: `Bearer ${token}`,
          })
        },
        didAuthError(error) {
          return error.graphQLErrors.some(
            e => e.extensions?.code === "UNAUTHENTICATED",
          )
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
            body: JSON.stringify({
              query: REFRESH_MUTATION,
              variables: { input: { token: refreshToken } },
            }),
          })
          const body: { data?: { refreshToken?: RefreshPayload } } =
            await res.json()
          const payload = body?.data?.refreshToken
          if (payload != null) {
            token = payload.token
            useAuthStore
              .getState()
              .setAuth(payload.token, payload.refreshToken, payload.user)
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
