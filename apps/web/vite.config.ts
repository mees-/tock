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

// index.html needs the absolute site URL for canonical and Open Graph tags.
process.env.VITE_SITE_URL = process.env.BASE_URL

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
