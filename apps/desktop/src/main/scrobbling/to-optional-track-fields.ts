/** Builds the optional album/albumArtist/durationSec fields shared by both
 * `client.updateNowPlaying` calls this module makes — `onScrobbleEligible`'s enqueue
 * and `onTrackChanged`'s live "now playing" push both start from the same
 * `TrackChangedEvent`/`ScrobbleEligibleEvent`'s `.track`, and `exactOptionalPropertyTypes`
 * means each optional field must be omitted entirely rather than set to `undefined` —
 * hence the conditional-spread idiom, centralized here so a shape change only needs
 * updating once instead of twice. */
export function toOptionalTrackFields(track: {
  readonly album?: string;
  readonly albumArtist?: string;
  readonly durationSec?: number;
}): { album?: string; albumArtist?: string; durationSec?: number } {
  return {
    ...(track.album ? { album: track.album } : {}),
    ...(track.albumArtist ? { albumArtist: track.albumArtist } : {}),
    ...(track.durationSec !== undefined ? { durationSec: track.durationSec } : {}),
  };
}
