import Database from "better-sqlite3";
import { type PendingScrobble } from "./pending-scrobble.js";
import { type QueuedScrobble } from "./queued-scrobble.js";
import { type ScrobbleRow } from "./scrobble-row.js";
import { rowToQueuedScrobble } from "./row-to-queued-scrobble.js";

const DAY_SEC = 24 * 60 * 60;
const DEFAULT_MAX_AGE_DAYS = 14;
const DEFAULT_MAX_ROWS = 1000;
/** Construction options for `ScrobbleQueue`: where the SQLite file lives and the eviction limits (14 days / 1000 rows by default). */
export interface ScrobbleQueueOptions {
  /** SQLite database file path, or ":memory:" for an ephemeral in-memory queue. */
  readonly databasePath: string;
  /** Scrobbles older than this (by their `timestamp`) are dropped by `evictStale`. */
  readonly maxAgeDays?: number;
  /** Row count above which `evictOverflow` starts dropping the oldest entries. */
  readonly maxRows?: number;
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

  /**
   * Opens (creating if needed) the SQLite database in WAL journal mode and ensures the
   * `pending_scrobbles` table and its `timestamp` index exist. Opening is synchronous,
   * so an unusable path throws from the constructor.
   */
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

  /**
   * Inserts a scrobble with `retryCount` 0 and the current time as `enqueuedAt`, and
   * returns it with its new row id. Duplicates are not detected; each call adds a row.
   */
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

  /**
   * Reads up to `limit` queued scrobbles, oldest play first (by `timestamp`). Despite
   * the name this does not delete them: callers `remove` the ones that were submitted
   * or `recordFailure` the ones that were not, so a crash mid-submit loses nothing.
   */
  dequeueBatch(limit: number): QueuedScrobble[] {
    const rows = this.db
      .prepare<{ limit: number }, ScrobbleRow>(
        `SELECT * FROM pending_scrobbles ORDER BY timestamp ASC LIMIT @limit`,
      )
      .all({ limit });
    return rows.map(rowToQueuedScrobble);
  }

  /** Deletes the rows with the given ids (e.g. after they were accepted); ids that no longer exist are ignored and an empty list does nothing. */
  remove(ids: readonly number[]): void {
    if (ids.length === 0) {
      return;
    }
    const placeholders = ids.map(() => "?").join(", ");
    this.db.prepare(`DELETE FROM pending_scrobbles WHERE id IN (${placeholders})`).run(...ids);
  }

  /**
   * Handles a scrobble whose submission failed. A retryable failure keeps the row,
   * increments `retry_count` and stores `reason` as `last_error` so it is attempted
   * again later; a non-retryable one deletes the row, since resubmitting would fail the
   * same way.
   */
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

  /** Number of scrobbles currently waiting in the queue (the pending count shown in the network status). */
  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM pending_scrobbles").get() as {
      count: number;
    };
    return row.count;
  }

  /** Closes the SQLite connection; the queue must not be used afterwards. */
  close(): void {
    this.db.close();
  }
}
