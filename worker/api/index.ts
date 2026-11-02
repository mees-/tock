import { Hono } from "hono"
import { cors } from "hono/cors"
import { env } from "../env"
import { auth, canSignup } from "./auth"
import { billingApi } from "./billing"
import { jobsApi } from "./jobs"
import { meApi } from "./me"

export const api = new Hono()
  .use(cors())
  .get("/config", async c =>
    c.json({
      communityEdition: env.COMMUNITY_EDITION,
      canSignup: await canSignup(),
    }),
  )
  .route("/auth", auth)
  .route("/me", meApi)
  .route("/jobs", jobsApi)
  .route("/billing", billingApi)

export type Api = typeof api
