import electron from "electron";
import { fetchArtistImageUrl, type LastfmClient } from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

/** The subset of `LastfmClient` this module needs — kept narrow for easy testing,
 * same convention as `ScrobblingClient` in `main/scrobbling/wire-scrobbling.ts`. */
export interface ArtistImageLastfmClient {
  getArtistImageUrl: LastfmClient["getArtistImageUrl"];
}

export interface WireArtistImageOptions {
  /** When given, tried first — Last.fm's own `artist.getInfo` photo (already filtered
   * for Last.fm's shared placeholder; see `LastfmClient.getArtistImageUrl`). Falls
   * through to Deezer (see below) on any failure — an artist Last.fm's catalog
   * doesn't have at all is a common, expected case, not a real error — or when
   * Last.fm simply has nothing real for this artist, which in practice is true for
   * the overwhelming majority of artists (see that method's docstring). Omit entirely
   * to skip Last.fm and go straight to Deezer, e.g. when no Last.fm API key is
   * configured for this build at all — see `main/index.ts`. */
  readonly lastfmClient?: ArtistImageLastfmClient;
  /** Injectable for testing; defaults to the global `fetch`. Only used for the Deezer
   * fallback — `lastfmClient`, if given, already carries its own fetch. */
  readonly fetchImpl?: typeof fetch;
}

async function resolveArtistImageUrl(
  artistName: string,
  lastfmClient: ArtistImageLastfmClient | undefined,
  fetchImpl: typeof fetch,
): Promise<string | undefined> {
  if (lastfmClient) {
    try {
      const url = await lastfmClient.getArtistImageUrl(artistName);
      if (url) {
        return url;
      }
    } catch {
      // Best-effort — see WireArtistImageOptions.lastfmClient's docstring for why a
      // failure here (most often: this artist isn't in Last.fm's catalog at all)
      // falls through to Deezer rather than surfacing as an error.
    }
  }
  return fetchArtistImageUrl(artistName, fetchImpl);
}

/**
 * Wires the real-artist-photo IPC surface (see `shared/artist-image-api.ts`) —
 * Last.fm's own `artist.getInfo` photo first when `lastfmClient` is given (see that
 * option's docstring for why it's usually a miss and Deezer's public artist search
 * remains the real primary source in practice), Deezer always as the guaranteed
 * fallback. No "not configured" state to handle for the *overall* handler, unlike
 * `wire-lastfm-data.ts`/`wire-bug-report.ts` — Deezer's search endpoint needs no API
 * key, so photos keep working even in a build with no Last.fm credentials at all.
 */
export function wireArtistImage(options: WireArtistImageOptions = {}): () => void {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lastfmClient = options.lastfmClient;

  ipcMain.handle(
    IPC_CHANNELS.artistImageGetUrl,
    (_event, artistName: unknown): Promise<string | undefined> =>
      resolveArtistImageUrl(String(artistName), lastfmClient, fetchImpl),
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.artistImageGetUrl);
  };
}
