import type { NetworkStatus } from "@lastfm-scrobbler/core";

export function formatTooltip(status: NetworkStatus): string {
  const base = "Last.fm Scrobbler";
  if (status.online === false) {
    return status.pendingCount > 0
      ? `${base} — Offline, ${status.pendingCount} pending`
      : `${base} — Offline`;
  }
  return status.pendingCount > 0 ? `${base} — ${status.pendingCount} pending` : base;
}
