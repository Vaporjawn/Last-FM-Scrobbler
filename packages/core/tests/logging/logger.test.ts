import { describe, expect, it, vi } from "vitest";
import { Logger } from "../../src/logging/logger.js";

describe("Logger", () => {
  it("records info/warn/error at the default 'basic' level", () => {
    const logger = new Logger();
    logger.info("hello");
    logger.warn("careful");
    logger.error("boom");

    const entries = logger.getRecentEntries();
    expect(entries.map((e) => e.message)).toEqual(["hello", "careful", "boom"]);
  });

  it("drops debug messages at the 'basic' level", () => {
    const logger = new Logger({ level: "basic" });
    logger.debug("verbose detail");

    expect(logger.getRecentEntries()).toEqual([]);
  });

  it("records debug messages at the 'debug' level", () => {
    const logger = new Logger({ level: "debug" });
    logger.debug("verbose detail");

    expect(logger.getRecentEntries()).toHaveLength(1);
    expect(logger.getRecentEntries()[0]).toMatchObject({ level: "debug", message: "verbose detail" });
  });

  it("records nothing at the 'none' level", () => {
    const logger = new Logger({ level: "none" });
    logger.info("hello");
    logger.warn("careful");
    logger.error("boom");

    expect(logger.getRecentEntries()).toEqual([]);
  });

  it("attaches optional structured metadata to an entry", () => {
    const logger = new Logger();
    logger.error("scrobble failed", { code: 9, track: "Idioteque" });

    expect(logger.getRecentEntries()[0]).toMatchObject({
      message: "scrobble failed",
      meta: { code: 9, track: "Idioteque" },
    });
  });

  it("stamps each entry with the injected clock", () => {
    const logger = new Logger({ now: () => 1_700_000_000_000 });
    logger.info("hello");

    expect(logger.getRecentEntries()[0]?.timestamp).toBe(1_700_000_000_000);
  });

  it("keeps only the most recent maxEntries, evicting the oldest first", () => {
    const logger = new Logger({ maxEntries: 3 });
    logger.info("one");
    logger.info("two");
    logger.info("three");
    logger.info("four");

    expect(logger.getRecentEntries().map((e) => e.message)).toEqual(["two", "three", "four"]);
  });

  it("getRecentEntries(limit) returns only the last `limit` entries", () => {
    const logger = new Logger();
    logger.info("one");
    logger.info("two");
    logger.info("three");

    expect(logger.getRecentEntries(2).map((e) => e.message)).toEqual(["two", "three"]);
  });

  it("forwards every recorded entry to the configured sink", () => {
    const sink = vi.fn();
    const logger = new Logger({ sink });
    logger.info("hello");

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ level: "info", message: "hello" }));
  });

  it("does not call the sink for a message the current level filters out", () => {
    const sink = vi.fn();
    const logger = new Logger({ level: "basic", sink });
    logger.debug("verbose detail");

    expect(sink).not.toHaveBeenCalled();
  });

  it("formats recent entries as plain text lines for a bug report", () => {
    const logger = new Logger({ now: () => 1_700_000_000_000 });
    logger.info("hello");
    logger.error("boom", { code: 9 });

    const text = logger.formatRecentEntriesAsText();
    expect(text).toContain("[INFO] hello");
    expect(text).toContain("[ERROR] boom");
    expect(text).toContain('"code":9');
  });
});
