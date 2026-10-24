import type { NetworkStatus } from "@lastfm-scrobbler/core";

/**
 * Builds the tray icon tooltip for a network status: the app name, followed by "Offline" when
 * the connection is known to be down and by the count of scrobbles still waiting to be sent
 * when that count is above zero.
 */
export function formatTooltip(status: NetworkStatus): string {
  const base = "Last.fm Scrobbler";
  if (status.online === false) {
    return status.pendingCount > 0
      ? `${base} — Offline, ${status.pendingCount} pending`
      : `${base} — Offline`;
  }
  return status.pendingCount > 0 ? `${base} — ${status.pendingCount} pending` : base;
}
