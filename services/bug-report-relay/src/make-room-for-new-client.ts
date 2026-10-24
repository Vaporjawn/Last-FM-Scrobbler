import { MAX_TRACKED_CLIENTS, SWEEP_INTERVAL } from "./rate-limit-settings.js";
import { requestLog, sweepCounter } from "./rate-limit-state.js";
import { sweepStaleEntries } from "./sweep-stale-entries.js";

/**
 * Called when the limiter is full and a new client arrives: first drops entries that have
 * aged out, and if every remaining one is still inside the window, forgets the client
 * that has been tracked longest (a `Map` iterates in insertion order). The cost is that
 * an old entry's quota resets early — strictly no worse than having no limiter for it.
 */
export function makeRoomForNewClient(now: number): void {
  sweepCounter.callsSinceSweep = SWEEP_INTERVAL;
  sweepStaleEntries(now);
  if (requestLog.size >= MAX_TRACKED_CLIENTS) {
    for (const oldest of requestLog.keys()) {
      requestLog.delete(oldest);
      break;
    }
  }
}
