import { AppCredentialsStore } from "@lastfm-scrobbler/core";
import {
  ElectronSecretStorage,
  type SafeStorageLike,
} from "../secret-storage/electron-secret-storage.js";

export interface CreateAppCredentialsStoreOptions {
  readonly filePath: string;
  readonly safeStorage: SafeStorageLike;
}

/**
 * Constructs an `AppCredentialsStore` backed by `ElectronSecretStorage`, or `undefined`
 * (with a logged warning, not a thrown error) if OS-level encryption isn't available on
 * this system — same reasoning as `main/auth/create-account-store.ts`. Kept as its own
 * file/store rather than sharing `AccountStore`'s: this holds a user-supplied
 * *application* credential (bring-your-own-key), not a per-user session key.
 */
export function createAppCredentialsStore(
  options: CreateAppCredentialsStoreOptions,
): AppCredentialsStore | undefined {
  try {
    const storage = new ElectronSecretStorage({
      filePath: options.filePath,
      safeStorage: options.safeStorage,
    });
    return new AppCredentialsStore(storage);
  } catch (error) {
    console.warn(
      "Could not set up secure storage for a user-supplied Last.fm API key — " +
        "bring-your-own-key will be unavailable this run:",
      error,
    );
    return undefined;
  }
}
