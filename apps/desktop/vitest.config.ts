import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    // The MUI-heavy page tests take ~0.5s each when idle and several times that when
    // the whole suite runs in parallel under coverage instrumentation.
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      // `.js` covers renderer/public/theme-init.js, a real runtime script the page loads
      // before first paint. Declaration files carry no runtime code.
      include: ["src/**/*.{ts,tsx,js}"],
      exclude: ["**/*.d.ts"],
      // Every source file must be fully covered. A genuinely unreachable defensive
      // branch is annotated in source with `/* v8 ignore ... -- @preserve */` plus the
      // reason, so exceptions stay visible in review instead of hiding in this config.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
