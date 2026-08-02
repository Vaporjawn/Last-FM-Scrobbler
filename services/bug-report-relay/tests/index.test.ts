// `SELF` is soft-deprecated in favor of `import { exports } from "cloudflare:workers"` +
// `exports.default.fetch()`, but that alternative requires declaring a project-specific
// `GlobalProps.mainModule` type augmentation (normally generated via `wrangler types`,
// which needs a deploy-context config we don't have set up yet). `SELF` is not
// scheduled for removal, so keeping it here is a deliberate, documented trade-off
// rather than an oversight.
/* eslint-disable @typescript-eslint/no-deprecated */
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("bug-report-relay fetch handler", () => {
  it("rejects non-POST requests", async () => {
    const response = await SELF.fetch("https://relay.example/report", { method: "GET" });
    expect(response.status).toBe(405);
  });

  it("rejects a request missing a title", async () => {
    const response = await SELF.fetch("https://relay.example/report", {
      method: "POST",
      body: JSON.stringify({ body: "steps to reproduce..." }),
    });
    expect(response.status).toBe(400);
    const payload = await response.json<{ error: string }>();
    expect(payload.error).toMatch(/title/);
  });

  it("accepts a well-formed report and reports not-implemented", async () => {
    const response = await SELF.fetch("https://relay.example/report", {
      method: "POST",
      body: JSON.stringify({
        title: "Crash on launch",
        body: "App crashes on launch on Linux.",
      }),
    });
    expect(response.status).toBe(501);
    const payload = await response.json<{ received: { title: string } }>();
    expect(payload.received.title).toBe("Crash on launch");
  });
});
