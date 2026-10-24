/**
 * Coarse transport state of the media session an adapter reports: actively playing,
 * paused with a track loaded, or nothing loaded. Emitted by every `PlaybackSource`
 * through `onPlaybackStateChanged`.
 */
export type PlaybackState = "playing" | "paused" | "stopped";
