// `SELF` is soft-deprecated in favor of `import { exports } from "cloudflare:workers"` +
// `exports.default.fetch()`, but that alternative requires declaring a project-specific
// `GlobalProps.mainModule` type augmentation (normally generated via `wrangler types`,
// which needs a deploy-context config we don't have set up yet). `SELF` is not
// scheduled for removal, so keeping it here is a deliberate, documented trade-off
// rather than an oversight.
/* eslint-disable @typescript-eslint/no-deprecated */
import { SELF } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";

/** Intercepts the relay's outbound call to GitHub's API — no real network request is
 * ever made in these tests. See fixtures/vitest-pool-workers-examples/request-mocking
 * in cloudflare/workers-sdk for the pattern this follows. */
function mockGitHubApi(handler: (request: Request) => Response | Promise<Response>): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    if (new URL(request.url).hostname === "api.github.com") {
      return handler(request);
    }
    throw new Error(`Unexpected outbound fetch to ${request.url}`);
  });
}

function postReport(clientIp: string, body: unknown): Promise<Response> {
  return SELF.fetch("https://relay.example/report", {
    method: "POST",
    headers: { "cf-connecting-ip": clientIp },
    body: JSON.stringify(body),
  });
}

// The relay's per-IP rate limiter is a module-scoped Map in the Worker under test — it
// is NOT reset between `it()` blocks within this file (only storage bindings like
// KV/Durable Objects get per-test isolation from @cloudflare/vitest-pool-workers, not
// plain in-memory globals). Every test below therefore uses its own IP address (a
// unique 203.0.113.0/24 host per test) so tests can never interfere with each other's
// rate-limit counters, regardless of execution order.

describe("bug-report-relay fetch handler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-POST requests", async () => {
    const response = await SELF.fetch("https://relay.example/report", { method: "GET" });
    expect(response.status).toBe(405);
  });

  it("rejects a request missing a title", async () => {
    const response = await postReport("203.0.113.10", { body: "steps to reproduce..." });
    expect(response.status).toBe(400);
    const payload = await response.json<{ error: string }>();
    expect(payload.error).toMatch(/title/);
  });

  it("creates a real GitHub issue for a well-formed report", async () => {
    interface CapturedRequest {
      readonly url: string;
      readonly headers: Headers;
      readonly body: { readonly title: string; readonly body: string };
    }
    let capturedRequest: CapturedRequest | undefined;
    mockGitHubApi(async (request) => {
      capturedRequest = {
        url: request.url,
        headers: request.headers,
        body: await request.json<CapturedRequest["body"]>(),
      };
      return new Response(
        JSON.stringify({
          html_url: "https://github.com/Vaporjawn/Last-FM-Scrobbler/issues/42",
          number: 42,
        }),
        { status: 201 },
      );
    });

    const response = await postReport("203.0.113.11", {
      title: "Crash on launch",
      body: "App crashes on launch on Linux.",
    });

    expect(response.status).toBe(201);
    const payload = await response.json<{ issueUrl: string; issueNumber: number }>();
    expect(payload).toEqual({
      issueUrl: "https://github.com/Vaporjawn/Last-FM-Scrobbler/issues/42",
      issueNumber: 42,
    });

    expect(capturedRequest?.url).toBe(
      "https://api.github.com/repos/Vaporjawn/Last-FM-Scrobbler/issues",
    );
    expect(capturedRequest?.headers.get("authorization")).toBe("Bearer test-github-pat");
    expect(capturedRequest?.headers.get("accept")).toBe("application/vnd.github+json");
    expect(capturedRequest?.headers.get("user-agent")).toBe("lastfm-scrobbler-bug-report-relay");
    expect(capturedRequest?.body.title).toBe("[BUG]: Crash on launch");
    expect(capturedRequest?.body.body).toContain("App crashes on launch on Linux.");
  });

  it("includes diagnostics in a collapsed section of the issue body", async () => {
    let capturedBody: { body: string } | undefined;
    mockGitHubApi(async (request) => {
      capturedBody = await request.json<{ body: string }>();
      return new Response(JSON.stringify({ html_url: "https://x", number: 1 }), { status: 201 });
    });

    await postReport("203.0.113.12", {
      title: "Scrobbles not submitting",
      body: "Nothing scrobbles even though playback is detected.",
      diagnostics: { "adapter-macos version": "0.0.0", "recent logs": "2026-08-01 ERROR ..." },
    });

    expect(capturedBody?.body).toContain("<details>");
    expect(capturedBody?.body).toContain("adapter-macos version");
    expect(capturedBody?.body).toContain("2026-08-01 ERROR ...");
  });

  it("returns 502 without leaking GitHub's error detail when issue creation fails", async () => {
    mockGitHubApi(() => new Response("secret internal detail", { status: 500 }));

    const response = await postReport("203.0.113.13", { title: "Crash", body: "Details here." });

    expect(response.status).toBe(502);
    const payload = await response.json<{ error: string }>();
    expect(payload.error).not.toContain("secret internal detail");
  });

  it("returns 500 (not 502) when GitHub rejects the request with a permanent 4xx status", async () => {
    // A 4xx from GitHub (bad/expired PAT, wrong repo, insufficient scope, etc.) is a
    // maintainer-side misconfiguration that retrying will never fix, unlike the
    // transient 5xx case above — so it gets its own status instead of a flat 502.
    mockGitHubApi(() => new Response("Bad credentials", { status: 401 }));

    const response = await postReport("203.0.113.17", { title: "Crash", body: "Details here." });

    expect(response.status).toBe(500);
    const payload = await response.json<{ error: string }>();
    expect(payload.error).not.toContain("Bad credentials");
  });

  it("returns 502 (not 500) when GitHub itself rate limits the request", async () => {
    // 429 is numerically a 4xx, but it's transient like a 5xx, not a permanent
    // misconfiguration — it must not fall into the "permanent 4xx" 500 bucket above.
    mockGitHubApi(() => new Response("API rate limit exceeded", { status: 429 }));

    const response = await postReport("203.0.113.18", { title: "Crash", body: "Details here." });

    expect(response.status).toBe(502);
  });

  it("returns 502 (not a false 201 success) when GitHub's 2xx response has an unexpected shape", async () => {
    // Regression test: response.json<T>() is only a compile-time type assertion —
    // nothing validated at runtime that a 2xx response actually had html_url/number.
    // A shape-drifted response used to be reported back to the caller as a false
    // `201 { issueUrl: undefined, issueNumber: undefined }` "success" that silently
    // lost the real result instead of surfacing as a failure.
    mockGitHubApi(() => new Response(JSON.stringify({ unexpected: "shape" }), { status: 201 }));

    const response = await postReport("203.0.113.15", { title: "Crash", body: "Details here." });

    expect(response.status).toBe(502);
    const payload = await response.json<{ error: string }>();
    expect(payload.error).toBeTruthy();
  });

  it("rate limits repeated requests from the same IP", async () => {
    mockGitHubApi(
      () => new Response(JSON.stringify({ html_url: "https://x", number: 1 }), { status: 201 }),
    );
    const ip = "203.0.113.14";

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await postReport(ip, {
        title: `Report ${i}`,
        body: "Body text long enough.",
      });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  });

  it("does not rate limit requests from a different IP", async () => {
    mockGitHubApi(
      () => new Response(JSON.stringify({ html_url: "https://x", number: 1 }), { status: 201 }),
    );

    for (let i = 0; i < 5; i++) {
      await postReport("203.0.113.15", { title: `Report ${i}`, body: "Body text long enough." });
    }
    const response = await postReport("203.0.113.16", {
      title: "One more",
      body: "Body text long enough.",
    });

    expect(response.status).toBe(201);
  });

  it("returns 502 when the request to GitHub fails outright (not a GitHub error response)", async () => {
    mockGitHubApi(() => {
      throw new TypeError("network down");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await postReport("203.0.113.30", { title: "Crash", body: "Details here." });

    expect(response.status).toBe(502);
  });

  it("treats a request with no client IP header as one shared 'unknown' client", async () => {
    const response = await SELF.fetch("https://relay.example/report", {
      method: "POST",
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it("returns 503 when the GITHUB_PAT secret is not configured", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const request = new Request("https://relay.example/report", {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.31" },
      body: JSON.stringify({ title: "Crash", body: "Details here." }),
    });

    const response = await worker.fetch(request, { GITHUB_PAT: "" });

    expect(response.status).toBe(503);
    expect(errorSpy).toHaveBeenCalledWith("bug-report-relay: GITHUB_PAT is not configured");
  });

  it("answers 400, without parser internals, for a body that is not JSON", async () => {
    const response = await SELF.fetch("https://relay.example/report", {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.32" },
      body: "{ not json",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Request body must be valid JSON" });
  });

  describe("housekeeping of the in-memory rate-limit log", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("forgets idle clients and prunes stale timestamps without losing fresh ones", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      const start = new Date("2026-01-01T00:00:00Z").getTime();
      const minutes = (count: number): number => count * 60 * 1000;

      // Client A makes one request and goes quiet; client B makes one now and another
      // six minutes later.
      vi.setSystemTime(start);
      await postReport("198.51.100.1", {});
      await postReport("198.51.100.2", {});
      vi.setSystemTime(start + minutes(6));
      await postReport("198.51.100.2", {});

      // Eleven minutes in: A's request and B's first have aged out of the 10-minute
      // window, B's second has not. Enough traffic from other clients to guarantee that
      // at least one periodic sweep runs while A and B are in that state.
      vi.setSystemTime(start + minutes(11));
      for (let i = 0; i < 100; i++) {
        await postReport(`198.51.101.${i}`, {});
      }

      // B's surviving timestamp must have been kept: four more requests make five in
      // the window, so the next one is rate limited.
      for (let i = 0; i < 4; i++) {
        expect((await postReport("198.51.100.2", {})).status).toBe(400);
      }
      expect((await postReport("198.51.100.2", {})).status).toBe(429);
    });
  });

  describe("request size and client tracking limits", () => {
    function directPost(
      ip: string,
      init: RequestInit & { duplex?: "half" } = {},
    ): Promise<Response> {
      return worker.fetch(
        new Request("https://relay.example/report", {
          method: "POST",
          headers: {
            "cf-connecting-ip": ip,
            ...(init.headers as Record<string, string> | undefined),
          },
          ...(init.body !== undefined ? { body: init.body } : {}),
          ...(init.duplex ? { duplex: init.duplex } : {}),
        }),
        { GITHUB_PAT: "test" },
      );
    }

    it("rejects a request whose declared size is over the limit without reading it", async () => {
      const response = await directPost("203.0.113.40", {
        headers: { "content-length": "2000000" },
        body: "{}",
      });

      expect(response.status).toBe(413);
    });

    it("rejects a body that grows past the limit even when no size was declared", async () => {
      const chunk = new TextEncoder().encode("x".repeat(100_000));
      let sent = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent >= 11) {
            controller.close();
            return;
          }
          sent += 1;
          controller.enqueue(chunk);
        },
      });

      const response = await directPost("203.0.113.41", { body: stream, duplex: "half" });

      expect(response.status).toBe(413);
    });

    it("answers 400, not a crash, to a POST with no body at all", async () => {
      const response = await directPost("203.0.113.42");

      expect(response.status).toBe(400);
    });

    it("accepts a multi-chunk body and reassembles characters split across chunks", async () => {
      const encoded = new TextEncoder().encode(JSON.stringify({ title: "tïtle", body: "bödy" }));
      const split = encoded.indexOf(0xc3) + 1; // between the two bytes of "ï"
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoded.slice(0, split));
          controller.enqueue(encoded.slice(split));
          controller.close();
        },
      });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ html_url: "https://github.com/x/y/issues/9", number: 9 }), {
          status: 201,
        }),
      );

      const response = await directPost("203.0.113.43", { body: stream, duplex: "half" });

      expect(response.status).toBe(201);
      const [, init] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];
      const sent = JSON.parse(init.body as string) as { title: string };
      expect(sent.title).toBe("[BUG]: tïtle");
    });

    it("makes room by dropping expired clients rather than evicting a live one", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        const start = new Date("2026-02-01T00:00:00Z").getTime();
        vi.setSystemTime(start);
        const liveIp = "198.19.0.1";
        for (let i = 0; i < 5; i++) {
          await directPost(liveIp);
        }
        for (let i = 0; i < 10_000; i++) {
          await directPost(
            `172.${String((i >> 16) & 255)}.${String((i >> 8) & 255)}.${String(i & 255)}`,
          );
        }

        // Eleven minutes on, everything above has expired; the next new client finds the
        // table full, sweeps it clean, and evicts nobody still being limited.
        vi.setSystemTime(start + 11 * 60 * 1000);
        for (let i = 0; i < 5; i++) {
          await directPost(liveIp);
        }
        await directPost("198.19.0.2");

        expect((await directPost(liveIp)).status).toBe(429);
      } finally {
        vi.useRealTimers();
      }
    });

    it("stays within its memory bound for many distinct clients, forgetting the oldest first", async () => {
      const firstIp = "198.18.0.1";
      for (let i = 0; i < 5; i++) {
        await directPost(firstIp);
      }
      expect((await directPost(firstIp)).status).toBe(429);

      for (let i = 0; i < 10_001; i++) {
        await directPost(
          `10.${String((i >> 16) & 255)}.${String((i >> 8) & 255)}.${String(i & 255)}`,
        );
      }

      // The earliest-tracked client was evicted to make room, so it starts afresh.
      expect((await directPost(firstIp)).status).toBe(400);
    });
  });
});
