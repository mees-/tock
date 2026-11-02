import { QueryClient } from "@tanstack/react-query"
import { DetailedError, hc, parseResponse } from "hono/client"
import type { ClientResponse, InferResponseType } from "hono/client"
import type { Api } from "../../worker/api/index"
import { useAuthStore } from "@/lib/auth/auth-store"

const API_BASE = "/api"
const UNAUTHORIZED = 401

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

useAuthStore.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id) queryClient.clear()
})

const publicApi = hc<Api>(API_BASE)

let pendingRefresh: Promise<boolean> | null = null

async function refreshAuth() {
  const { refreshToken, setAuth, clearAuth } = useAuthStore.getState()
  if (refreshToken == null) return false
  const res = await publicApi.auth.refresh.$post({ json: { refreshToken } })
  if (!res.ok) {
    clearAuth()
    return false
  }
  const payload = await res.json()
  setAuth(payload.token, payload.refreshToken, payload.user)
  return true
}

function refreshAuthOnce() {
  pendingRefresh ??= refreshAuth().finally(() => {
    pendingRefresh = null
  })
  return pendingRefresh
}

function withToken(init: RequestInit | undefined, token: string) {
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${token}`)
  return { ...init, headers }
}

async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const token = useAuthStore.getState().token
  if (token == null) return fetch(input, init)

  const res = await fetch(input, withToken(init, token))
  if (res.status !== UNAUTHORIZED || !(await refreshAuthOnce())) return res

  const refreshed = useAuthStore.getState().token
  return refreshed == null ? res : fetch(input, withToken(init, refreshed))
}

export const api = hc<Api>(API_BASE, { fetch: authFetch })

function errorMessage(error: DetailedError) {
  const data: unknown = error.detail?.data
  if (typeof data === "object" && data != null && "error" in data) {
    return String(data.error)
  }
  return error.message
}

export async function unwrap<T extends ClientResponse<unknown>>(
  request: Promise<T>,
) {
  try {
    return await parseResponse(request)
  } catch (error) {
    if (error instanceof DetailedError) throw new Error(errorMessage(error))
    throw error
  }
}

export type Job = InferResponseType<(typeof api.jobs)[":id"]["$get"], 200>
export type JobRun = InferResponseType<
  (typeof api.jobs)[":id"]["runs"]["$get"],
  200
>["runs"][number]
