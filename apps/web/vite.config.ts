import "dotenv/config"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"
import sitemap from "vite-plugin-sitemap"

const SEOExcludedPaths = [
  "/dashboard",
  "/jobs",
  "/settings",
  "/login",
  "/setup",
]

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    sitemap({
      hostname: process.env.BASE_URL,
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
  ],
  base: process.env.BASE_URL,
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
})
