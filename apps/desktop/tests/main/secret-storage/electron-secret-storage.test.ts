import { chmodSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ElectronSecretStorage } from "../../../src/main/secret-storage/electron-secret-storage.js";

/** Fake `safeStorage` — reversible but not real encryption, so tests don't depend on
 * an actual OS keychain being available (CI runners often lack one). */
function fakeSafeStorage(encryptionAvailable = true) {
  return {
    isEncryptionAvailable: () => encryptionAvailable,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, "utf8"),
    decryptString: (buffer: Buffer) => buffer.toString("utf8").replace(/^enc:/, ""),
  };
}

describe("ElectronSecretStorage", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "secret-storage-test-"));
    filePath = join(dir, "secrets.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns undefined for a key that was never set", async () => {
    const storage = new ElectronSecretStorage({ filePath, safeStorage: fakeSafeStorage() });

    await expect(storage.get("missing")).resolves.toBeUndefined();
  });

  it("round-trips a value through set/get", async () => {
    const storage = new ElectronSecretStorage({ filePath, safeStorage: fakeSafeStorage() });

    await storage.set("account:alice", "session-key-123");

    await expect(storage.get("account:alice")).resolves.toBe("session-key-123");
  });

  it("persists across separate ElectronSecretStorage instances (same file)", async () => {
    const first = new ElectronSecretStorage({ filePath, safeStorage: fakeSafeStorage() });
    await first.set("account:alice", "session-key-123");

    const second = new ElectronSecretStorage({ filePath, safeStorage: fakeSafeStorage() });

    await expect(second.get("account:alice")).resolves.toBe("session-key-123");
  });

  it("list() returns every stored key", async () => {
    const storage = new ElectronSecretStorage({ filePath, safeStorage: fakeSafeStorage() });
    await storage.set("account:alice", "key1");
    await storage.set("account:bob", "key2");
    await storage.set("__active_account__", "alice");

    const keys = await storage.list();

    expect(new Set(keys)).toEqual(new Set(["account:alice", "account:bob", "__active_account__"]));
  });

  it("delete() removes a key without affecting others", async () => {
    const storage = new ElectronSecretStorage({ filePath, safeStorage: fakeSafeStorage() });
    await storage.set("account:alice", "key1");
    await storage.set("account:bob", "key2");

    await storage.delete("account:alice");

    await expect(storage.get("account:alice")).resolves.toBeUndefined();
    await expect(storage.get("account:bob")).resolves.toBe("key2");
  });

  it("delete() on a nonexistent key is a harmless no-op", async () => {
    const storage = new ElectronSecretStorage({ filePath, safeStorage: fakeSafeStorage() });

    await expect(storage.delete("never-set")).resolves.toBeUndefined();
  });

  it("actually encrypts values at rest — the raw file contents don't contain the plaintext", async () => {
    const storage = new ElectronSecretStorage({ filePath, safeStorage: fakeSafeStorage() });
    await storage.set("account:alice", "super-secret-session-key");

    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(filePath, "utf8");

    expect(raw).not.toContain("super-secret-session-key");
  });

  it("throws a clear error at construction when OS-level encryption is unavailable", () => {
    expect(() => {
      new ElectronSecretStorage({ filePath, safeStorage: fakeSafeStorage(false) });
    }).toThrow(/encryption is not available/i);
  });

  // Mode bits aren't meaningful on Windows the way they are on POSIX systems — skip
  // there rather than asserting something that wouldn't mean what it looks like it
  // means (matches how this codebase already branches on platform elsewhere, e.g.
  // NowPlayingPage's `isMac` checks).
  it.skipIf(process.platform === "win32")(
    "restricts the secrets file to owner-only read/write (0o600), even on an existing file with looser permissions",
    async () => {
      const storage = new ElectronSecretStorage({ filePath, safeStorage: fakeSafeStorage() });
      await storage.set("account:alice", "key1");
      // Simulate a file left over from before this fix, with the old (looser) default
      // permissions — set() must tighten these on every write, not just at creation.
      chmodSync(filePath, 0o644);

      await storage.set("account:bob", "key2");

      const mode = statSync(filePath).mode & 0o777;
      expect(mode).toBe(0o600);
    },
  );
});
