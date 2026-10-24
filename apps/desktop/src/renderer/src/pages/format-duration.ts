/** Formats a duration in whole seconds as `m:ss` (e.g. 340 -> "5:40"). Track durations
 * only ever need minutes:seconds here — nothing in this app plays anything long enough
 * to need an hours component. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
