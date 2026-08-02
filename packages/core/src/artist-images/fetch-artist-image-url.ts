const DEEZER_SEARCH_URL = "https://api.deezer.com/search/artist";

/**
 * Deezer's own shared "no photo on file" placeholder — every image URL for an artist
 * with no real photo embeds this exact path segment instead of a per-artist hash.
 * Verified live: searching generically-named catalog entries ("DJ", "Unknown") that
 * plainly have no real photo returns this hash, while every genuinely-named real
 * artist gets a distinct one. It's the MD5 hash of an empty string
 * (`d41d8cd98f00b204e9800998ecf8427e`) — Deezer's own sentinel for "nothing here",
 * not a coincidence. Same category of gotcha as Last.fm's own artist-image
 * placeholder (see `ArtistInfo`'s docstring in `../lastfm-api/types.ts`), so it gets
 * the same treatment: detect it and treat it as no image at all.
 */
const DEEZER_NO_PHOTO_HASH = "d41d8cd98f00b204e9800998ecf8427e";

interface DeezerArtistJson {
  readonly name: string;
  readonly picture_xl?: string;
  readonly picture_big?: string;
  readonly picture_medium?: string;
}

interface DeezerSearchResponse {
  readonly data?: readonly DeezerArtistJson[];
}

/**
 * Real per-artist photos — sourced from Deezer's public artist search, not Last.fm.
 * Last.fm's own `artist.getInfo`/`user.getTopArtists` only ever return a shared
 * generic placeholder for artist images (see `ArtistInfo`'s docstring), a known,
 * long-standing issue on their side. Deezer's `search/artist` endpoint is a public,
 * unauthenticated GET (verified live — no API key, no signing) that returns real,
 * per-artist photos at several sizes; this picks the largest available.
 *
 * Best-effort by design: no artist match, a request failure, or Deezer's own "no
 * photo" placeholder (see `DEEZER_NO_PHOTO_HASH`) all resolve to `undefined` rather
 * than throwing — a missing decorative photo shouldn't be able to break a page that
 * otherwise has everything it needs. Callers that want to distinguish "tried and
 * found nothing" from "never tried" should look at whether they called this at all,
 * not at this function's return type.
 */
export async function fetchArtistImageUrl(
  artistName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | undefined> {
  const url = new URL(DEEZER_SEARCH_URL);
  url.searchParams.set("q", artistName);
  url.searchParams.set("limit", "1");

  try {
    const response = await fetchImpl(url.toString());
    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as DeezerSearchResponse;
    const artist = payload.data?.[0];
    const imageUrl = artist?.picture_xl ?? artist?.picture_big ?? artist?.picture_medium;

    if (!imageUrl || imageUrl.includes(DEEZER_NO_PHOTO_HASH)) {
      return undefined;
    }

    return imageUrl;
  } catch {
    return undefined;
  }
}
