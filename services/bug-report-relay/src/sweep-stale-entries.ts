import { RATE_LIMIT_WINDOW_MS, SWEEP_INTERVAL } from "./rate-limit-settings.js";
import { requestLog, sweepCounter } from "./rate-limit-state.js";

/**
 * Sweeps every IP's own entry for timestamps that have aged out of the rate-limit
 * window, deleting any entry that ends up empty. `isRateLimited` only ever
 * prunes *the current caller's own* entry — an IP that stops sending requests
 * otherwise keeps its (small, but permanent) entry in `requestLog` forever, so a
 * long-lived warm isolate under sustained traffic from many thousands of distinct
 * IPs would grow the map without bound. Runs only every `SWEEP_INTERVAL` calls
 * (not on every request) since a full-map scan is real work not worth paying for
 * on the common, already-handled path.
 */
export function sweepStaleEntries(now: number): void {
  sweepCounter.callsSinceSweep += 1;
  if (sweepCounter.callsSinceSweep < SWEEP_INTERVAL) {
    return;
  }
  sweepCounter.callsSinceSweep = 0;

  for (const [ip, timestamps] of requestLog) {
    const fresh = timestamps.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) {
      requestLog.delete(ip);
    } else if (fresh.length !== timestamps.length) {
      requestLog.set(ip, fresh);
    }
  }
}
