import { type TrackMetadata } from "./track-metadata.js";

/**
 * Maps a scrobble or now-playing submission onto ListenBrainz's `track_metadata`
 * object: artist becomes `artist_name`, track becomes `track_name`, and a non-empty
 * album becomes `release_name`. Other submission fields (duration, track number,
 * album artist, MBID) are not forwarded.
 */
export function toTrackMetadata(submission: {
  readonly artist: string;
  readonly track: string;
  readonly album?: string;
}): TrackMetadata {
  return {
    artist_name: submission.artist,
    track_name: submission.track,
    ...(submission.album ? { release_name: submission.album } : {}),
  };
}
