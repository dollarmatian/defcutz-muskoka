import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  // The app's tsconfig sets jsx: "preserve" for Next, so the test runner needs
  // its own transform to parse component tests.
  plugins: [react()],
  test: {
    environment: "node", // per-file docblocks opt into jsdom
    include: ["tests/**/*.test.{ts,tsx,mjs}"],
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
})
