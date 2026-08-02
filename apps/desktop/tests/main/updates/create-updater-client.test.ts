import { describe, expect, it, vi } from "vitest";
import { Logger } from "@lastfm-scrobbler/core";

const autoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: true,
  logger: null as unknown,
};

vi.mock("electron-updater", () => ({ autoUpdater, default: { autoUpdater } }));

const { createUpdaterClient } = await import("../../../src/main/updates/create-updater-client.js");

describe("createUpdaterClient", () => {
  it("returns the autoUpdater singleton configured for auto-download without auto-install-on-quit", () => {
    const client = createUpdaterClient({ logger: new Logger({ level: "none" }) });

    expect(client).toBe(autoUpdater);
    expect(autoUpdater.autoDownload).toBe(true);
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
  });

  it("forwards autoUpdater's log messages to the injected Logger", () => {
    const entries: string[] = [];
    const logger = new Logger({
      level: "debug",
      sink: (entry) => {
        entries.push(`${entry.level}:${entry.message}`);
      },
    });

    createUpdaterClient({ logger });
    const updaterLogger = autoUpdater.logger as {
      info: (m: unknown) => void;
      warn: (m: unknown) => void;
      error: (m: unknown) => void;
      debug: (m: unknown) => void;
    };
    updaterLogger.info("checking for update");
    updaterLogger.warn("slow response");
    updaterLogger.error("download failed");
    updaterLogger.debug("verbose detail");

    expect(entries).toEqual([
      "info:checking for update",
      "warn:slow response",
      "error:download failed",
      "debug:verbose detail",
    ]);
  });
});
