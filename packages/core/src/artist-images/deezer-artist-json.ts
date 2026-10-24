/**
 * One artist entry from the `data` array of Deezer's public `search/artist` response,
 * reduced to the fields the app reads: the artist's name plus the picture URLs at the
 * sizes it can choose from (largest first in `pickRealPhotoUrl`'s fallback order).
 * Any picture field may be absent, and may point at Deezer's shared "no photo" image.
 */
export interface DeezerArtistJson {
  readonly name: string;
  readonly picture_xl?: string;
  readonly picture_big?: string;
  readonly picture_medium?: string;
}
