import React from "react"
import ReactDOM from "react-dom/client"
import { Provider as UrqlProvider } from "urql"
import { PostHogProvider } from "@posthog/react"
import { client } from "@/lib/graphql/client"
import { env } from "@/env"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UrqlProvider value={client}>
      <PostHogProvider
        apiKey={env.VITE_PUBLIC_POSTHOG_KEY}
        options={{
          api_host: env.VITE_PUBLIC_POSTHOG_HOST,
          defaults: "2026-01-30",
        }}
      >
        <App />
      </PostHogProvider>
    </UrqlProvider>
  </React.StrictMode>,
)
