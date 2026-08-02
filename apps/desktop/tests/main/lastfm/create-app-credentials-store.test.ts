import { describe, expect, it, vi } from "vitest";
import { AppCredentialsStore } from "@lastfm-scrobbler/core";
import { createAppCredentialsStore } from "../../../src/main/lastfm/create-app-credentials-store.js";

describe("createAppCredentialsStore", () => {
  it("returns an AppCredentialsStore when OS-level encryption is available", () => {
    const store = createAppCredentialsStore({
      filePath: "/tmp/does-not-matter.json",
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (s: string) => Buffer.from(s),
        decryptString: (b: Buffer) => b.toString(),
      },
    });

    expect(store).toBeInstanceOf(AppCredentialsStore);
  });

  it("returns undefined (not throwing) when OS-level encryption is unavailable, logging a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const store = createAppCredentialsStore({
      filePath: "/tmp/does-not-matter.json",
      safeStorage: {
        isEncryptionAvailable: () => false,
        encryptString: (s: string) => Buffer.from(s),
        decryptString: (b: Buffer) => b.toString(),
      },
    });

    expect(store).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
