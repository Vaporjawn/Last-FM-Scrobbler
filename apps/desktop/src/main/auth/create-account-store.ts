import { AccountStore } from "@lastfm-scrobbler/core";
import {
  ElectronSecretStorage,
  type SafeStorageLike,
} from "../secret-storage/electron-secret-storage.js";

export interface CreateAccountStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/**
 * Constructs an `AccountStore` backed by `ElectronSecretStorage`, or `undefined` (with
 * a logged warning, not a thrown error) if OS-level encryption isn't available on this
 * system. On Linux especially, `safeStorage` depends on a system keyring that minimal
 * window-manager setups can lack — that shouldn't crash the whole app at startup, just
 * disable the account/login features that need to persist a session key securely.
 */
export function createAccountStore(options: CreateAccountStoreOptions): AccountStore | undefined {
  try {
    const storage = new ElectronSecretStorage({
      filePath: options.filePath,
      safeStorage: options.safeStorage,
    });
    return new AccountStore(storage);
  } catch (error) {
    console.warn(
      "Could not set up secure account storage — login will be unavailable this run:",
      error,
    );
    return undefined;
  }
}
