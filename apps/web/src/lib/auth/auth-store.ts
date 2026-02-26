import { create } from "zustand"
import { persist } from "zustand/middleware"

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: { id: number; username: string; role: string } | null
  setAuth: (token: string, refreshToken: string, user: AuthState["user"]) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
      clearAuth: () => set({ token: null, refreshToken: null, user: null }),
    }),
    { name: "tock-auth" },
  ),
)
