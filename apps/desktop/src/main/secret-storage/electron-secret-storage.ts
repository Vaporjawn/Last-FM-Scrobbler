import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";
import type { SecretStorage } from "@lastfm-scrobbler/core";

/** The subset of Electron's `safeStorage` this class needs — narrowed for easy testing. */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

/** Where `ElectronSecretStorage` keeps its file and which `safeStorage` encrypts the values. */
export interface ElectronSecretStorageOptions {
  /** Where to persist the encrypted key-value store, e.g. `app.getPath("userData")/secrets.json`. */
  readonly filePath: string;
  /** Injectable for testing; production callers pass Electron's real `safeStorage`. */
  readonly safeStorage: SafeStorageLike;
}

/** On-disk shape: each value is `safeStorage.encryptString`'s output, base64-encoded (JSON has no binary type). */
type SecretsFile = Record<string, string>;

/**
 * Implements `packages/core`'s `SecretStorage` using Electron's `safeStorage` (OS
 * keychain — macOS Keychain, Windows DPAPI, or libsecret on Linux) for the actual
 * encryption, with the encrypted blobs persisted in a single JSON file under the app's
 * userData directory. Synchronous under the hood (`safeStorage` and `fs` are both
 * sync APIs) but implements the async `SecretStorage` interface `AccountStore` expects.
 *
 * Throws at construction if OS-level encryption isn't available — on Linux in
 * particular, `safeStorage` depends on a system keyring (e.g. gnome-keyring,
 * kwallet) that minimal window-manager setups can lack. Failing fast here with a
 * clear message is better than silently persisting session keys in plaintext.
 */
export class ElectronSecretStorage implements SecretStorage {
  private readonly filePath: string;
  private readonly safeStorage: SafeStorageLike;

  /**
   * Creates the storage over the given file and `safeStorage`; nothing is read or written yet.
   *
   * @throws When `safeStorage` reports that OS-level encryption is unavailable, so secrets are
   * never written unencrypted. Callers such as `createAccountStore` catch this and disable the
   * features that need persistent secrets.
   */
  constructor(options: ElectronSecretStorageOptions) {
    if (!options.safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "ElectronSecretStorage: OS-level encryption is not available on this system " +
          "(Electron's safeStorage.isEncryptionAvailable() returned false). On Linux this " +
          "usually means no system keyring (e.g. gnome-keyring, kwallet) is running.",
      );
    }
    this.filePath = options.filePath;
    this.safeStorage = options.safeStorage;
  }

  /** Runs `operation` so that a failure (unreadable keychain entry, full disk) comes back
   * as a rejected promise, which is what every caller of this async interface handles. As
   * plain synchronous methods returning `Promise.resolve(...)` they threw straight out of
   * the call instead, past any `.catch(...)` a caller had chained. */
  private run<T>(operation: () => T): Promise<T> {
    return new Promise<T>((resolve) => {
      resolve(operation());
    });
  }

  /** Decrypts and returns the value stored under `key`, or `undefined` when there is none. */
  get(key: string): Promise<string | undefined> {
    return this.run(() => {
      const encoded = this.readFile()[key];
      return encoded === undefined
        ? undefined
        : this.safeStorage.decryptString(Buffer.from(encoded, "base64"));
    });
  }

  /** Encrypts `value` and saves it under `key`, replacing any previous value, in the secrets file. */
  set(key: string, value: string): Promise<void> {
    return this.run(() => {
      const file = this.readFile();
      file[key] = this.safeStorage.encryptString(value).toString("base64");
      this.writeFile(file);
    });
  }

  /** Removes the entry for `key`; the file is only rewritten when the key was actually present. */
  delete(key: string): Promise<void> {
    return this.run(() => {
      const file = this.readFile();
      if (key in file) {
        Reflect.deleteProperty(file, key);
        this.writeFile(file);
      }
    });
  }

  /** Lists every stored key; values stay encrypted and are not decrypted. */
  list(): Promise<readonly string[]> {
    return this.run(() => Object.keys(this.readFile()));
  }

  /**
   * Reads the secrets file into a null-prototype map of still-encrypted values. A missing file
   * reads as empty; a file that is not valid JSON or not a plain object is moved aside (see
   * `setCorruptFileAside`) and also reads as empty. Non-string entries are dropped.
   */
  private readFile(): SecretsFile {
    if (!existsSync(this.filePath)) {
      return Object.create(null) as SecretsFile;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.filePath, "utf8"));
    } catch {
      this.setCorruptFileAside();
      return Object.create(null) as SecretsFile;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      this.setCorruptFileAside();
      return Object.create(null) as SecretsFile;
    }

    // A null-prototype object holding only string values, so a key such as
    // "constructor" or "__proto__" can never resolve to something inherited.
    const file = Object.create(null) as SecretsFile;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        file[key] = value;
      }
    }
    return file;
  }

  /** Moves an unreadable secrets file out of the way instead of treating it as empty and
   * letting the next write overwrite it: the encrypted entries in it may still be
   * recoverable by hand, and silently destroying them would be unrecoverable. */
  private setCorruptFileAside(): void {
    try {
      renameSync(this.filePath, `${this.filePath}.corrupt`);
    } catch {
      // Best effort — the file may have vanished, or be read-only. Reading carries on.
    }
  }

  /** Writes to a sibling temp file, flushes it to disk, then renames it over the real
   * file. Rename is atomic, so a crash or power loss mid-write leaves the previous
   * complete file in place instead of a truncated one that reads back as "no accounts". */
  private writeFile(file: SecretsFile): void {
    mkdirSync(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const tempPath = `${this.filePath}.${String(process.pid)}.tmp`;
    const descriptor = openSync(tempPath, "w", 0o600);
    try {
      writeSync(descriptor, JSON.stringify(file, null, 2));
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    try {
      renameSync(tempPath, this.filePath);
    } catch (error) {
      rmSync(tempPath, { force: true });
      throw error;
    }
  }
}
