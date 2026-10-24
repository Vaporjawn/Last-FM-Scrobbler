/**
 * Limits for the relay's in-memory, per-isolate rate limiter. Kept together because they
 * describe one policy and `is-rate-limited.ts`, `sweep-stale-entries.ts` and
 * `make-room-for-new-client.ts` all read them.
 */

/** Requests from the same IP within this window beyond `RATE_LIMIT_MAX_REQUESTS` are rejected. */
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/** Most requests one address may make inside `RATE_LIMIT_WINDOW_MS`. */
export const RATE_LIMIT_MAX_REQUESTS = 5;

/** Most clients the in-memory limiter remembers at once. Without a cap, a flood of
 * requests from many distinct addresses (cheap to produce over IPv6) grows the map for as
 * long as their entries stay inside the window — an isolate-memory exhaustion lever. */
export const MAX_TRACKED_CLIENTS = 10_000;

/** How often (in number of `isRateLimited` calls) to run the full sweep in
 * `sweep-stale-entries.ts` — not every call, to keep the common case cheap. */
export const SWEEP_INTERVAL = 100;
