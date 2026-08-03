import { LastfmClient, type AppCredentials } from "@lastfm-scrobbler/core";

/** Libre.fm's own equivalent of Last.fm's `ws.audioscrobbler.com` API endpoint —
 * protocol-identical (see `LastfmClient`'s own docstring on `baseUrl`), so this
 * reuses `LastfmClient` directly rather than a parallel implementation. **Not
 * independently live-verified this session** beyond `auth.getToken` tolerating a
 * garbage/missing `api_key` (lax validation at that specific step) — the full signed
 * flow (`auth.getSession`, `track.scrobble`) was not confirmed end-to-end (a real
 * verification attempt hit Cloudflare rate-limiting before completing, and wasn't
 * retried further to avoid hammering a real third-party service). If Libre.fm turns
 * out to reject requests signed with an unregistered key/secret pair, the fix is
 * purely a documentation one (users need a real Libre.fm-issued key) — nothing about
 * this client's shape would need to change. */
const LIBREFM_BASE_URL = "https://libre.fm/2.0/";
/** Libre.fm's presumed equivalent of Last.fm's `www.last.fm/api/auth/` authorization
 * page, by analogy with Last.fm's own API/auth-page domain split (see
 * `LastfmClientOptions.authUrl`'s docstring) — **not independently live-verified this
 * session**, unlike the `/2.0/` API endpoint behaviors above. If this path is wrong,
 * `login()` in `wire-secondary-auth.ts` will open a browser to a broken page; the fix
 * is a one-line change to this constant once the real URL is confirmed. */
const LIBREFM_AUTH_URL = "https://libre.fm/api/auth/";

/** Builds a `LastfmClient` pointed at Libre.fm instead of Last.fm, from an
 * already-resolved key/secret pair (see `resolve-librefm-credentials.ts` — this
 * function itself does no env/storage lookups, just client construction). Shared by
 * both the login flow (`createLibrefmAuthFlowClient` — no `sessionKey` yet, since
 * login is how one gets minted) and `main/index.ts`'s scrobbling wiring (a
 * session-keyed client, once an account is connected) — `LastfmClient` satisfies both
 * `AuthFlowClient` and `ScrobblingClient` structurally, so one factory covers both
 * call sites. */
export function buildLibrefmClient(
  credentials: AppCredentials,
  options: { readonly sessionKey?: string } = {},
): LastfmClient {
  return new LastfmClient({
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    baseUrl: LIBREFM_BASE_URL,
    authUrl: LIBREFM_AUTH_URL,
    ...(options.sessionKey !== undefined ? { sessionKey: options.sessionKey } : {}),
  });
}
