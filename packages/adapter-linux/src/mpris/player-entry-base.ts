import type { TrackInfo } from "@lastfm-scrobbler/shared-types";

/**
 * Fields every tracked MPRIS player has regardless of its playback state; `PlayerEntry`
 * adds the state-specific part. Held per bus name by `PlayerRegistry`.
 */
export interface PlayerEntryBase {
  readonly track: TrackInfo | null;
  /** Timestamp of the most recent genuine change to this player's track/state. */
  readonly lastChangedAt: number;
}
