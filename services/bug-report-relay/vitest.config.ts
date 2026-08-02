import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      // A fake PAT for tests only — real GitHub API calls are mocked via
      // `vi.spyOn(globalThis, "fetch")` in tests/index.test.ts, never actually made.
      // The real secret is set via `wrangler secret put GITHUB_PAT` and never committed.
      miniflare: { bindings: { GITHUB_PAT: "test-github-pat" } },
      wrangler: { configPath: "./wrangler.toml" },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
