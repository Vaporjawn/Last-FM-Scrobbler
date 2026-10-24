import { type PendingScrobble } from "./pending-scrobble.js";

/** A `PendingScrobble` plus its queue bookkeeping. */
export interface QueuedScrobble extends PendingScrobble {
  readonly id: number;
  readonly enqueuedAt: number;
  readonly retryCount: number;
  readonly lastError?: string;
}
