import { defineConfig } from "bunup"

export default defineConfig({
  entry: ["src/index.ts", "src/openai.ts", "src/ai-sdk.ts", "src/anthropic.ts", "src/jsx-runtime.ts", "src/jsx-dev-runtime.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  minify: true,
  splitting: true,
})
