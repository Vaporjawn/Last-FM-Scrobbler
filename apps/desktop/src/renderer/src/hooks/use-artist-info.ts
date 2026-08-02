import { useEffect, useState } from "react";
import type { ArtistInfo, SimilarArtist } from "@lastfm-scrobbler/core";

export interface ArtistInfoState {
  readonly info: ArtistInfo | undefined;
  readonly similarArtists: readonly SimilarArtist[];
  readonly loading: boolean;
  readonly error: string | undefined;
}

const EMPTY: ArtistInfoState = {
  info: undefined,
  similarArtists: [],
  loading: false,
  error: undefined,
};

/**
 * Fetches `artist.getInfo` + `artist.getSimilar` for `artistName` via `window.lastfm`
 * (see `src/shared/lastfm-api.ts`) — the bio/stats/similar-artists panel under Now
 * Playing. Both are public, unsigned endpoints, so this works regardless of whether an
 * account is logged in. Returns the inert empty state — never throws — when
 * `artistName` is undefined (nothing playing) or `window.lastfm` isn't present.
 */
export function useArtistInfo(artistName: string | undefined): ArtistInfoState {
  const [state, setState] = useState<ArtistInfoState>(EMPTY);

  useEffect(() => {
    if (!artistName || !window.lastfm) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: undefined }));

    Promise.all([window.lastfm.getArtistInfo(artistName), window.lastfm.getSimilarArtists(artistName, 4)])
      .then(([info, similarArtists]) => {
        if (!cancelled) {
          setState({ info, similarArtists, loading: false, error: undefined });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            info: undefined,
            similarArtists: [],
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artistName]);

  return state;
}
