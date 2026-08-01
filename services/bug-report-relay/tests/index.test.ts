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
    const payload = (await response.json()) as { error: string };
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
    const payload = (await response.json()) as { received: { title: string } };
    expect(payload.received.title).toBe("Crash on launch");
  });
});
