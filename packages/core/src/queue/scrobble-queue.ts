import Database from "better-sqlite3";

const DAY_SEC = 24 * 60 * 60;
const DEFAULT_MAX_AGE_DAYS = 14;
const DEFAULT_MAX_ROWS = 1000;

/** A scrobble waiting to be submitted to Last.fm. */
export interface PendingScrobble {
  readonly artist: string;
  readonly track: string;
  readonly album?: string;
  readonly albumArtist?: string;
  /** Unix seconds — when the track *started* playing, per Last.fm's scrobble API. */
  readonly timestamp: number;
  readonly durationSec?: number;
}

/** A `PendingScrobble` plus its queue bookkeeping. */
export interface QueuedScrobble extends PendingScrobble {
  readonly id: number;
  readonly enqueuedAt: number;
  readonly retryCount: number;
  readonly lastError?: string;
}

export interface ScrobbleQueueOptions {
  /** SQLite database file path, or ":memory:" for an ephemeral in-memory queue. */
  readonly databasePath: string;
  /** Scrobbles older than this (by their `timestamp`) are dropped by `evictStale`. */
  readonly maxAgeDays?: number;
  /** Row count above which `evictOverflow` starts dropping the oldest entries. */
  readonly maxRows?: number;
}

interface ScrobbleRow {
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

function rowToQueuedScrobble(row: ScrobbleRow): QueuedScrobble {
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

/**
 * Persistent offline cache for scrobbles that couldn't be submitted immediately (no
 * network, Last.fm temporarily unavailable, rate limited, ...). See
 * docs/adr/0006-offline-queue-persistence.md for the eviction policy this implements.
 */
export class ScrobbleQueue {
  private readonly db: Database.Database;
  private readonly maxAgeDays: number;
  private readonly maxRows: number;

  constructor(options: ScrobbleQueueOptions) {
    this.db = new Database(options.databasePath);
    this.maxAgeDays = options.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
    this.maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pending_scrobbles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artist TEXT NOT NULL,
        track TEXT NOT NULL,
        album TEXT,
        album_artist TEXT,
        timestamp INTEGER NOT NULL,
        duration_sec INTEGER,
        enqueued_at INTEGER NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_pending_scrobbles_timestamp
        ON pending_scrobbles (timestamp);
    `);
  }

  enqueue(scrobble: PendingScrobble): QueuedScrobble {
    const enqueuedAt = Math.floor(Date.now() / 1000);
    const result = this.db
      .prepare(
        `INSERT INTO pending_scrobbles
           (artist, track, album, album_artist, timestamp, duration_sec, enqueued_at)
         VALUES (@artist, @track, @album, @albumArtist, @timestamp, @durationSec, @enqueuedAt)`,
      )
      .run({
        artist: scrobble.artist,
        track: scrobble.track,
        album: scrobble.album ?? null,
        albumArtist: scrobble.albumArtist ?? null,
        timestamp: scrobble.timestamp,
        durationSec: scrobble.durationSec ?? null,
        enqueuedAt,
      });

    return {
      ...scrobble,
      id: Number(result.lastInsertRowid),
      enqueuedAt,
      retryCount: 0,
    };
  }

  dequeueBatch(limit: number): QueuedScrobble[] {
    const rows = this.db
      .prepare<{ limit: number }, ScrobbleRow>(
        `SELECT * FROM pending_scrobbles ORDER BY timestamp ASC LIMIT @limit`,
      )
      .all({ limit });
    return rows.map(rowToQueuedScrobble);
  }

  remove(ids: readonly number[]): void {
    if (ids.length === 0) {
      return;
    }
    const placeholders = ids.map(() => "?").join(", ");
    this.db.prepare(`DELETE FROM pending_scrobbles WHERE id IN (${placeholders})`).run(...ids);
  }

  recordFailure(
    id: number,
    options: { readonly retryable: boolean; readonly reason: string },
  ): void {
    if (options.retryable) {
      this.db
        .prepare(
          `UPDATE pending_scrobbles
             SET retry_count = retry_count + 1, last_error = @reason
           WHERE id = @id`,
        )
        .run({ id, reason: options.reason });
    } else {
      this.remove([id]);
    }
  }

  /** Drops scrobbles older than `maxAgeDays`. Returns the number of rows evicted. */
  evictStale(now: number = Math.floor(Date.now() / 1000)): number {
    const cutoff = now - this.maxAgeDays * DAY_SEC;
    const result = this.db
      .prepare(`DELETE FROM pending_scrobbles WHERE timestamp < @cutoff`)
      .run({ cutoff });
    return result.changes;
  }

  /** Drops the oldest rows beyond `maxRows`. Returns the number of rows evicted. */
  evictOverflow(): number {
    const result = this.db
      .prepare(
        `DELETE FROM pending_scrobbles
          WHERE id IN (
            SELECT id FROM pending_scrobbles
            ORDER BY timestamp ASC
            LIMIT MAX(0, (SELECT COUNT(*) FROM pending_scrobbles) - @maxRows)
          )`,
      )
      .run({ maxRows: this.maxRows });
    return result.changes;
  }

  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM pending_scrobbles").get() as {
      count: number;
    };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}
