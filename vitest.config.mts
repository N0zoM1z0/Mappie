import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/core/**/*.ts"],
      reporter: ["text", "html"],
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
    include: ["tests/*.test.ts"],
  },
});
