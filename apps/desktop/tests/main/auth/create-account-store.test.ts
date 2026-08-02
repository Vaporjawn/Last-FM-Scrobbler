import { describe, expect, it, vi } from "vitest";
import { AccountStore } from "@lastfm-scrobbler/core";
import { createAccountStore } from "../../../src/main/auth/create-account-store.js";

describe("createAccountStore", () => {
  it("returns an AccountStore when OS-level encryption is available", () => {
    const store = createAccountStore({
      filePath: "/tmp/does-not-matter.json",
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (s: string) => Buffer.from(s),
        decryptString: (b: Buffer) => b.toString(),
      },
    });

    expect(store).toBeInstanceOf(AccountStore);
  });

  it("returns undefined (not throwing) when OS-level encryption is unavailable, logging a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const store = createAccountStore({
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
