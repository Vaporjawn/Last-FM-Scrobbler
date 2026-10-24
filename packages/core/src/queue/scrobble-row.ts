/** A `pending_scrobbles` table row exactly as better-sqlite3 returns it (snake_case columns, `null` for unset values); `rowToQueuedScrobble` converts it. */
export interface ScrobbleRow {
  id: number;
  artist: string;
  track: string;
  album: string | null;
  album_artist: string | null;
  timestamp: number;
  duration_sec: number | null;
  enqueued_at: number;
  retry_count: number;
  last_error: string | null;
}
