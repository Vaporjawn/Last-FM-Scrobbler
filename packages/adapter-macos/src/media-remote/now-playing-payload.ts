/**
 * Loosely-typed shape of `mediaremote-adapter`'s "get"/"stream" payload. Every field is
 * optional — the adapter only ever guarantees `title`/`artist`/`playing`/`bundleIdentifier`
 * are non-null *when a payload represents valid media*; a track with no title is
 * reported as invalid (empty payload) by design. See vendor/mediaremote-adapter/VENDORED.md.
 */
export interface NowPlayingPayload {
  readonly title?: string;
  readonly artist?: string;
  readonly album?: string;
  readonly duration?: number;
  readonly elapsedTime?: number;
  readonly playbackRate?: number;
  readonly playing?: boolean;
  readonly timestamp?: string;
  readonly bundleIdentifier?: string;
  readonly radioStationIdentifier?: string;
  readonly radioStationHash?: string;
}
