import { defineConfig, mergeConfig } from "vitest/config"
import viteConfig from "./vite.config.ts"

// The poster is all browser: a character grid, a viewport, and a stream. The
// tests run it in jsdom against the same alias and JSX transform the app builds
// with, so a test failure is a poster failure and not a config difference.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    include: ["src/**/*.test.{ts,tsx}"],
  },
}))
