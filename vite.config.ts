import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { cloudflare } from "@cloudflare/vite-plugin"
import { resolve } from "path"
import sitemap from "vite-plugin-sitemap"
import { devCron } from "./scripts/dev-cron"

const SEOExcludedPaths = [
  "/dashboard",
  "/jobs",
  "/settings",
  "/login",
  "/setup",
]

// index.html needs the absolute site URL for canonical and Open Graph tags.
process.env.VITE_SITE_URL = process.env.BASE_URL

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),
    devCron(),
    {
      ...sitemap({
        hostname: process.env.BASE_URL,
        outDir: "dist/client",
        changefreq: "weekly",
        exclude: SEOExcludedPaths,
        robots: [
          {
            userAgent: "*",
            allow: "/",
            disallow: SEOExcludedPaths,
          },
        ],
        generateRobotsTxt: true,
      }),
      applyToEnvironment: environment => environment.name === "client",
    },
  ],
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "./src") },
  },
  server: {
    port: 5173,
  },
})
