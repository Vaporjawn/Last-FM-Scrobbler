import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SecretStorage } from "@lastfm-scrobbler/core";

/** The subset of Electron's `safeStorage` this class needs — narrowed for easy testing. */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

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

  get(key: string): Promise<string | undefined> {
    const file = this.readFile();
    const encoded = file[key];
    if (encoded === undefined) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.safeStorage.decryptString(Buffer.from(encoded, "base64")));
  }

  set(key: string, value: string): Promise<void> {
    const file = this.readFile();
    file[key] = this.safeStorage.encryptString(value).toString("base64");
    this.writeFile(file);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    const file = this.readFile();
    if (key in file) {
      Reflect.deleteProperty(file, key);
      this.writeFile(file);
    }
    return Promise.resolve();
  }

  list(): Promise<readonly string[]> {
    return Promise.resolve(Object.keys(this.readFile()));
  }

  private readFile(): SecretsFile {
    if (!existsSync(this.filePath)) {
      return {};
    }
    return JSON.parse(readFileSync(this.filePath, "utf8")) as SecretsFile;
  }

  private writeFile(file: SecretsFile): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(file, null, 2), "utf8");
  }
}
