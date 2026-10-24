import type { CreateMainWindowOptions } from "../create-main-window.js";

/**
 * The scrobbling callbacks the main window hands to its `Tracker`, plus the cleanup to run
 * at quit. Every field is `undefined` when scrobbling is not wired (no secure storage).
 */
export interface ScrobblingService {
  /** Fires when a play becomes eligible to scrobble. */
  readonly onScrobbleEligible?: CreateMainWindowOptions["onScrobbleEligible"];
  /** Fires on every new track, to push a real-time "now playing" update. */
  readonly onTrackChanged?: CreateMainWindowOptions["onTrackChanged"];
  /**
   * Releases what scrobbling holds open (its drain timer and the SQLite queue file) right
   * before the process exits.
   */
  readonly stop?: () => void;
}
