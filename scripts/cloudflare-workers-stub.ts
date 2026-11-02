import { plugin } from "bun"

// Lets Bun evaluate Worker modules (e.g. for schema generation) outside workerd.
const STUB_ENV = {
  DB: {},
  JWT_SECRET: "schema-generation-placeholder-secret",
  COMMUNITY_EDITION: "true",
}

plugin({
  name: "cloudflare-workers-stub",
  setup(build) {
    build.module("cloudflare:workers", () => ({
      loader: "object",
      exports: { env: STUB_ENV },
    }))
  },
})
