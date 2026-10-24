import { ONE_MINUTE_MS } from "./one-minute-ms.js";
import { ONE_HOUR_MS } from "./one-hour-ms.js";

/**
 * Formats an elapsed duration (milliseconds, under a day in practice) as four "time ago"
 * strings ordered from most detailed to most terse: "Just now" under a minute, "Nm ago"
 * under an hour and "Nh ago" beyond that, each with a bare "Now"/"Nm"/"Nh" as the last
 * entry. The first three slots are identical by design: the unit abbreviation is already
 * as short as the phrase usefully gets, so only the final fallback drops "ago".
 */
export function formatRelativeCandidates(
  elapsedMs: number,
): readonly [string, string, string, string] {
  if (elapsedMs < ONE_MINUTE_MS) {
    return ["Just now", "Just now", "Just now", "Now"];
  }
  if (elapsedMs < ONE_HOUR_MS) {
    const minutes = Math.floor(elapsedMs / ONE_MINUTE_MS);
    // Same standardized "6h ago" shape as the hour tier below, not a shrinking ladder
    // of differently-worded lengths — see this function's docstring.
    const label = `${minutes}m ago`;
    return [label, label, label, `${minutes}m`];
  }
  const hours = Math.floor(elapsedMs / ONE_HOUR_MS);
  const label = `${hours}h ago`;
  return [label, label, label, `${hours}h`];
}
