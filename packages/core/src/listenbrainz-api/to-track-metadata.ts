import { type TrackMetadata } from "./track-metadata.js";

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
