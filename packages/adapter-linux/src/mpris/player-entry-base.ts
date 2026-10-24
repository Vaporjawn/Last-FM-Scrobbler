import type { TrackInfo } from "@lastfm-scrobbler/shared-types";

export interface PlayerEntryBase {
  readonly track: TrackInfo | null;
  /** Timestamp of the most recent genuine change to this player's track/state. */
  readonly lastChangedAt: number;
}
