import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { PostHogProvider } from "@posthog/react"
import { queryClient } from "@/lib/api"
import { env } from "@/env"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PostHogProvider
        apiKey={env.VITE_PUBLIC_POSTHOG_KEY}
        options={{
          api_host: env.VITE_PUBLIC_POSTHOG_HOST,
          defaults: "2026-01-30",
        }}
      >
        <App />
      </PostHogProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
