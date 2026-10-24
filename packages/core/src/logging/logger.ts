import { type LogSeverity } from "./log-severity.js";
import { type LogLevel } from "./log-level.js";
import { isEnabled } from "./is-enabled.js";

/** One recorded log message with its time, severity and optional structured context, as held in the ring buffer and passed to the sink. */
export interface LogEntry {
  /** Unix milliseconds. */
  readonly timestamp: number;
  readonly level: LogSeverity;
  readonly message: string;
  readonly meta?: Record<string, unknown>;
}
/** Construction options for `Logger`; every field is optional. `now` replaces the clock, mainly for tests. */
export interface LoggerOptions {
  /** "none" logs nothing; "basic" skips debug; "debug" logs everything. Default "basic". */
  readonly level?: LogLevel;
  /** Ring-buffer size for `getRecentEntries`. Default 500. */
  readonly maxEntries?: number;
  /** Called for every entry that passes the level filter — e.g. write to a file. */
  readonly sink?: (entry: LogEntry) => void;
  readonly now?: () => number;
}
const DEFAULT_MAX_ENTRIES = 500;
/**
 * Structured logger with a bounded in-memory ring buffer, feeding both live debugging
 * and the bug-report feature's "recent log lines" attachment (see
 * docs/adr/0004-anonymous-bug-report-relay.md). Callers are responsible for not
 * logging secrets (Last.fm session keys, etc.) — the logger has no way to know what's
 * sensitive.
 */
export class Logger {
  private readonly level: LogLevel;
  private readonly maxEntries: number;
  private readonly sink: ((entry: LogEntry) => void) | undefined;
  private readonly now: () => number;
  private readonly entries: LogEntry[] = [];

  /** Applies the defaults: level `basic`, a 500-entry buffer, no sink, and `Date.now` as the clock. */
  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "basic";
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.sink = options.sink;
    this.now = options.now ?? Date.now;
  }

  /** Records a debug-severity message; only kept when the logger's level is `debug`. */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.record("debug", message, meta);
  }

  /** Records an info-severity message, kept at levels `basic` and `debug`. */
  info(message: string, meta?: Record<string, unknown>): void {
    this.record("info", message, meta);
  }

  /** Records a warning-severity message, kept at levels `basic` and `debug`. */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.record("warn", message, meta);
  }

  /** Records an error-severity message, kept at levels `basic` and `debug`. */
  error(message: string, meta?: Record<string, unknown>): void {
    this.record("error", message, meta);
  }

  /**
   * Returns a copy of the buffered entries, oldest first. With `limit`, only the most
   * recent `limit` entries are returned (all of them if fewer are buffered).
   */
  getRecentEntries(limit?: number): readonly LogEntry[] {
    if (limit === undefined) {
      return [...this.entries];
    }
    return this.entries.slice(Math.max(0, this.entries.length - limit));
  }

  /** Plain-text rendering of recent entries, suitable for attaching to a bug report. */
  formatRecentEntriesAsText(limit?: number): string {
    return this.getRecentEntries(limit)
      .map((entry) => {
        const time = new Date(entry.timestamp).toISOString();
        const metaSuffix = entry.meta ? ` ${JSON.stringify(entry.meta)}` : "";
        return `${time} [${entry.level.toUpperCase()}] ${entry.message}${metaSuffix}`;
      })
      .join("\n");
  }

  /**
   * Shared path behind the severity methods: drops the message if `isEnabled` says the
   * level filters it out, otherwise stamps it, appends it to the ring buffer (evicting
   * the oldest entry once `maxEntries` is exceeded) and forwards it to the sink.
   */
  private record(severity: LogSeverity, message: string, meta?: Record<string, unknown>): void {
    if (!isEnabled(this.level, severity)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: this.now(),
      level: severity,
      message,
      ...(meta !== undefined ? { meta } : {}),
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    this.sink?.(entry);
  }
}
