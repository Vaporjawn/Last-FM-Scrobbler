import { type ScrobbleRow } from "./scrobble-row.js";
import { type QueuedScrobble } from "./queued-scrobble.js";

export function rowToQueuedScrobble(row: ScrobbleRow): QueuedScrobble {
  return {
    id: row.id,
    artist: row.artist,
    track: row.track,
    ...(row.album !== null ? { album: row.album } : {}),
    ...(row.album_artist !== null ? { albumArtist: row.album_artist } : {}),
    timestamp: row.timestamp,
    ...(row.duration_sec !== null ? { durationSec: row.duration_sec } : {}),
    enqueuedAt: row.enqueued_at,
    retryCount: row.retry_count,
    ...(row.last_error !== null ? { lastError: row.last_error } : {}),
  };
}
