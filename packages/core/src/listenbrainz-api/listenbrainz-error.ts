/**
 * Thrown for any non-2xx response from ListenBrainz's API. `code` is the HTTP status —
 * that's the one part of ListenBrainz's error envelope this client relies on for
 * control flow (retry-vs-not is decided by the caller — see
 * `apps/desktop/src/main/scrobbling/wire-scrobbling.ts` — based on whether the whole
 * request threw at all, same convention as `LastfmApiError`/`LastfmClient.scrobble`).
 * `message` is best-effort, parsed defensively from whichever of the response body's
 * `error`/`message` fields is present (ListenBrainz's own docs and this client's own
 * live verification of `/1/validate-token` show both field names in use across
 * different endpoints — see `ListenBrainzClient`'s docstring) — never assumed present.
 */
export class ListenBrainzApiError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "ListenBrainzApiError";
    this.code = code;
  }
}
