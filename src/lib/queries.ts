import { useQuery } from "@tanstack/react-query"
import { api, unwrap } from "@/lib/api"

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => unwrap(api.config.$get()),
    staleTime: Infinity,
  })
}

export function usePrices() {
  return useQuery({
    queryKey: ["prices"],
    queryFn: () => unwrap(api.billing.prices.$get()),
    staleTime: Infinity,
  })
}
