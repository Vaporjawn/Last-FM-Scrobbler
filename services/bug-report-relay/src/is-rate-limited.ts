import { makeRoomForNewClient } from "./make-room-for-new-client.js";
import {
  MAX_TRACKED_CLIENTS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from "./rate-limit-settings.js";
import { requestLog } from "./rate-limit-state.js";
import { sweepStaleEntries } from "./sweep-stale-entries.js";

/**
 * Records one request from `clientIp` and reports whether it should be rejected. Prunes
 * only the caller's own entry on each call; `sweepStaleEntries` handles everyone else, and
 * `makeRoomForNewClient` keeps the map from growing past `MAX_TRACKED_CLIENTS`.
 */
export function isRateLimited(clientIp: string, now: number): boolean {
  const timestamps = (requestLog.get(clientIp) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (!requestLog.has(clientIp) && requestLog.size >= MAX_TRACKED_CLIENTS) {
    makeRoomForNewClient(now);
  }

  let limited: boolean;
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(clientIp, timestamps);
    limited = true;
  } else {
    timestamps.push(now);
    requestLog.set(clientIp, timestamps);
    limited = false;
  }

  sweepStaleEntries(now);
  return limited;
}
