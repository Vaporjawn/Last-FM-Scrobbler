/** The `track_metadata` object of a ListenBrainz listen, using ListenBrainz's own snake_case field names. */
export interface TrackMetadata {
  readonly artist_name: string;
  readonly track_name: string;
  readonly release_name?: string;
}
