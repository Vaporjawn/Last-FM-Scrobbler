import type { SecretStorage } from "./secret-storage.js";

/** A Last.fm API key/secret pair identifying an application to Last.fm's API. */
export interface AppCredentials {
  readonly apiKey: string;
  readonly apiSecret: string;
}

const APP_CREDENTIALS_KEY = "app-credentials";

/** Construction options for `AppCredentialsStore`. */
export interface AppCredentialsStoreOptions {
  /** Same reasoning and same default (`""`, fully backward compatible) as
   * `AccountStoreOptions.namespace` — lets a second instance (e.g. for a
   * user-supplied Libre.fm key/secret pair) share one `SecretStorage` with the
   * original Last.fm instance without colliding on the bare `"app-credentials"` key. */
  readonly namespace?: string;
}

/**
 * Persists a user-supplied API key/secret pair for an Audioscrobbler-protocol service
 * (Last.fm, or — via a second, namespaced instance — Libre.fm) — the "bring your own
 * key" alternative to a build shipping with credentials baked in via environment
 * variables (see `apps/desktop/src/main/lastfm/create-lastfm-client.ts` and
 * `resolve-lastfm-credentials.ts`, both Last.fm-specific; Libre.fm has no baked-in-key
 * story at all, so it's always user-supplied). Whichever source is used, the app talks
 * to the service exactly the same way afterward — this only changes where the
 * key/secret come from. Backed by the same `SecretStorage` abstraction `AccountStore`
 * uses, kept as a separate store since this holds an *application* credential, not a
 * per-user one.
 */
export class AppCredentialsStore {
  private readonly storage: SecretStorage;
  private readonly key: string;

  /**
   * Creates a store over `storage`; nothing is read or written until a method is called.
   *
   * @param storage - Secret store the key/secret pair is written to.
   * @param options - Optional key namespace so several services can share `storage`.
   */
  constructor(storage: SecretStorage, options: AppCredentialsStoreOptions = {}) {
    this.storage = storage;
    this.key = `${options.namespace ?? ""}${APP_CREDENTIALS_KEY}`;
  }

  /** The saved key/secret pair, or `undefined` when the user has not supplied one yet. */
  async get(): Promise<AppCredentials | undefined> {
    const raw = await this.storage.get(this.key);
    return raw ? (JSON.parse(raw) as AppCredentials) : undefined;
  }

  /** Saves `credentials`, replacing any pair already stored under this store's key. */
  async set(credentials: AppCredentials): Promise<void> {
    await this.storage.set(this.key, JSON.stringify(credentials));
  }

  /** Removes the saved key/secret pair so the service reads as unconfigured again. */
  async clear(): Promise<void> {
    await this.storage.delete(this.key);
  }
}
