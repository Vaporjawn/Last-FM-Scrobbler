import { LastfmClient } from "@lastfm-scrobbler/core";

export interface CreateLastfmClientOptions {
  /** Injectable for testing; defaults to `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly sessionKey?: string;
}

/**
 * Constructs a `LastfmClient` from `LASTFM_API_KEY`/`LASTFM_API_SECRET` environment
 * variables, or returns `undefined` if either is missing.
 *
 * These credentials identify *this application* to Last.fm's API (every user of this
 * app authenticates through the same registered application, then gets their own
 * per-user session key via `AuthFlow`) — they are not something individual end users
 * provide. The app's maintainer registers an application at
 * https://www.last.fm/api/account/create and supplies its key/secret via environment
 * variables at build/run time; see docs/modules/desktop.md for exactly how to set
 * these for development and for packaged builds. This project never generates or
 * hardcodes real Last.fm credentials.
 */
export function createLastfmClient(options: CreateLastfmClientOptions = {}): LastfmClient | undefined {
  const env = options.env ?? process.env;
  const apiKey = env.LASTFM_API_KEY;
  const apiSecret = env.LASTFM_API_SECRET;

  if (!apiKey || !apiSecret) {
    return undefined;
  }

  return new LastfmClient({
    apiKey,
    apiSecret,
    ...(options.sessionKey !== undefined ? { sessionKey: options.sessionKey } : {}),
  });
}
