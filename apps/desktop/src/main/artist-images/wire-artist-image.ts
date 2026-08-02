import electron from "electron";
import { fetchArtistImageUrl } from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

export interface WireArtistImageOptions {
  /** Injectable for testing; defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * Wires the real-artist-photo IPC surface (see `shared/artist-image-api.ts`) to
 * `fetchArtistImageUrl` (Deezer's public artist search — see that function's
 * docstring for why Last.fm itself can't be the source here). No "not configured"
 * state to handle, unlike `wire-lastfm-data.ts`/`wire-bug-report.ts` — Deezer's
 * search endpoint needs no API key, so this is always available.
 */
export function wireArtistImage(options: WireArtistImageOptions = {}): () => void {
  const fetchImpl = options.fetchImpl ?? fetch;

  ipcMain.handle(
    IPC_CHANNELS.artistImageGetUrl,
    (_event, artistName: unknown): Promise<string | undefined> =>
      fetchArtistImageUrl(String(artistName), fetchImpl),
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.artistImageGetUrl);
  };
}
