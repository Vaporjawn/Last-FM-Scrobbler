/**
 * Best-effort per-IP rate limit state, backed by an in-memory `Map` scoped to this Worker
 * isolate. This is deliberately not a strong guarantee: Cloudflare may route requests
 * from the same IP to different isolates/edge locations, and an idle isolate can be
 * evicted at any time, resetting its counters. It still meaningfully raises the cost of
 * casual abuse from a single source at effectively zero operational complexity (no KV/
 * Durable Object namespace to provision). A stronger, globally-consistent limit (e.g. a
 * Durable Object per IP, or Cloudflare's Rate Limiting bindings) is a reasonable future
 * upgrade — see docs/modules/bug-report-relay.md. Private to this Worker: it is tightly
 * coupled to the isolate-scoped state below and has no meaning outside handling a
 * request for this specific Worker.
 */
export const requestLog = new Map<string, number[]>();

/**
 * How many `isRateLimited` calls have happened since the last full sweep. A property of
 * an object (not a bare `let`) so the several single-function modules that update it
 * share one live binding.
 */
export const sweepCounter = { callsSinceSweep: 0 };
