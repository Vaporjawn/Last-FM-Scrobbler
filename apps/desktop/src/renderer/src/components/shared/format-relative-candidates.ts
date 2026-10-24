import { ONE_MINUTE_MS } from "./one-minute-ms.js";
import { ONE_HOUR_MS } from "./one-hour-ms.js";

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
