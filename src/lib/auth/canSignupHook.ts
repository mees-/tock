import { useConfig } from "@/lib/queries"

export const useCanSignup = () => useConfig().data?.canSignup ?? true
