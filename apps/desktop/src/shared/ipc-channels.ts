/**
 * IPC channel names shared between the main process (sender) and preload script
 * (listener, via `contextBridge`) — kept in one place so the two sides can't drift
 * apart on a typo'd string literal.
 */
export const IPC_CHANNELS = {
  nowPlayingTrackChanged: "now-playing:track-changed",
  nowPlayingStateChanged: "now-playing:state-changed",
  /** Renderer -> main `invoke`: pulls the current snapshot on mount, since a
   * newly-attached listener otherwise only sees *future* push updates and would show
   * nothing until the next track/state change even if something is already playing. */
  nowPlayingGetCurrent: "now-playing:get-current",
} as const;
