export const env = {
  GRAPHQL_ENDPOINT: import.meta.env["VITE_GRAPHQL_ENDPOINT"] ?? "/graphql",
  VITE_PUBLIC_POSTHOG_KEY: import.meta.env["VITE_PUBLIC_POSTHOG_KEY"],
  VITE_PUBLIC_POSTHOG_HOST: import.meta.env["VITE_PUBLIC_POSTHOG_HOST"],
}
