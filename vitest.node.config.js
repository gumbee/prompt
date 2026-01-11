import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@gumbee/prompt/jsx-runtime": resolve(__dirname, "src/jsx-runtime.ts"),
      "@gumbee/prompt/jsx-dev-runtime": resolve(__dirname, "src/jsx-dev-runtime.ts"),
      "@gumbee/prompt/openai": resolve(__dirname, "src/adapters/openai.ts"),
      "@gumbee/prompt/ai-sdk": resolve(__dirname, "src/adapters/ai-sdk.ts"),
      "@gumbee/prompt/anthropic": resolve(__dirname, "src/adapters/anthropic.ts"),
      "@gumbee/prompt": resolve(__dirname, "src/index.ts"),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@gumbee/prompt",
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    testTimeout: 10000,
    globals: true,
  },
})
