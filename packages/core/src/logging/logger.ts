export type LogLevel = "none" | "basic" | "debug";
export type LogSeverity = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  /** Unix milliseconds. */
  readonly timestamp: number;
  readonly level: LogSeverity;
  readonly message: string;
  readonly meta?: Record<string, unknown>;
}

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

function isEnabled(level: LogLevel, severity: LogSeverity): boolean {
  if (level === "none") {
    return false;
  }
  if (level === "basic" && severity === "debug") {
    return false;
  }
  return true;
}

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

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "basic";
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.sink = options.sink;
    this.now = options.now ?? Date.now;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.record("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.record("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.record("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.record("error", message, meta);
  }

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
