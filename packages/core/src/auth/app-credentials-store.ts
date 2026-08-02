import type { SecretStorage } from "./secret-storage.js";

/** A Last.fm API key/secret pair identifying an application to Last.fm's API. */
export interface AppCredentials {
  readonly apiKey: string;
  readonly apiSecret: string;
}

const APP_CREDENTIALS_KEY = "app-credentials";

/**
 * Persists a user-supplied Last.fm API key/secret pair — the "bring your own key"
 * alternative to a build shipping with `LASTFM_API_KEY`/`LASTFM_API_SECRET` baked in
 * via environment variables (see `apps/desktop/src/main/lastfm/create-lastfm-client.ts`
 * and `resolve-lastfm-credentials.ts`). Whichever source is used, the app talks to
 * Last.fm exactly the same way afterward — this only changes where the key/secret
 * come from. Backed by the same `SecretStorage` abstraction `AccountStore` uses, kept
 * as a separate store since this holds an *application* credential, not a per-user one.
 */
export class AppCredentialsStore {
  constructor(private readonly storage: SecretStorage) {}

  async get(): Promise<AppCredentials | undefined> {
    const raw = await this.storage.get(APP_CREDENTIALS_KEY);
    return raw ? (JSON.parse(raw) as AppCredentials) : undefined;
  }

  async set(credentials: AppCredentials): Promise<void> {
    await this.storage.set(APP_CREDENTIALS_KEY, JSON.stringify(credentials));
  }

  async clear(): Promise<void> {
    await this.storage.delete(APP_CREDENTIALS_KEY);
  }
}
