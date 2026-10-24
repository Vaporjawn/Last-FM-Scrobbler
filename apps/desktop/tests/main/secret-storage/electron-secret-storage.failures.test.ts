// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type * as NodeFs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const renameControl = vi.hoisted(() => ({ fail: false }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();
  return {
    ...actual,
    renameSync: (from: string, to: string) => {
      if (renameControl.fail) {
        throw new Error("EXDEV: simulated rename failure");
      }
      actual.renameSync(from, to);
    },
  };
});

import { ElectronSecretStorage } from "../../../src/main/secret-storage/electron-secret-storage.js";

const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value: string) => Buffer.from(`enc:${value}`, "utf8"),
  decryptString: (buffer: Buffer) => buffer.toString("utf8").replace(/^enc:/, ""),
};

describe("ElectronSecretStorage when the filesystem misbehaves", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "secret-storage-failure-test-"));
    filePath = join(dir, "secrets.json");
    renameControl.fail = false;
  });

  afterEach(() => {
    renameControl.fail = false;
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps the previous file intact, and cleans up its temp file, when replacing it fails", async () => {
    const storage = new ElectronSecretStorage({ filePath, safeStorage });
    await storage.set("account:alice", "key1");
    const before = readFileSync(filePath, "utf8");

    renameControl.fail = true;
    await expect(storage.set("account:bob", "key2")).rejects.toThrow(/simulated rename failure/);
    renameControl.fail = false;

    expect(readFileSync(filePath, "utf8")).toBe(before);
    expect(readdirSync(dir)).toEqual(["secrets.json"]);
  });

  it("still reads on when it cannot move a damaged file aside", async () => {
    writeFileSync(filePath, "{ not valid json", "utf8");
    const storage = new ElectronSecretStorage({ filePath, safeStorage });

    renameControl.fail = true;

    await expect(storage.list()).resolves.toEqual([]);
    expect(existsSync(`${filePath}.corrupt`)).toBe(false);
  });
});
