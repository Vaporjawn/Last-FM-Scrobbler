import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Every source file must be fully covered. A genuinely unreachable defensive
      // branch is annotated in source with `/* v8 ignore ... -- @preserve */` plus the
      // reason, so exceptions stay visible in review instead of hiding in this config.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
