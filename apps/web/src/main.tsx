import React from "react"
import ReactDOM from "react-dom/client"
import { Provider as UrqlProvider } from "urql"
import { client } from "@/lib/graphql/client"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <UrqlProvider value={client}>
      <App />
    </UrqlProvider>
  </React.StrictMode>,
)
