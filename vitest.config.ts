import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testEnv } from "./tests/setup/env.ts";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    env: { ...testEnv },
    globalSetup: ["tests/setup/global.ts"],
    setupFiles: ["tests/setup/each.ts"],
    // Feature tests share one database, so test files run one at a time.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/generated/**", "src/**/*.test.ts"],
      reporter: ["text", "lcov"],
    },
  },
});
