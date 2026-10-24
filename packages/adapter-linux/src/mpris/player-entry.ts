import type { PlaybackState } from "@lastfm-scrobbler/shared-types";
import { type PlayerEntryBase } from "./player-entry-base.js";

/** A discriminated union, so "currently playing" statically implies a known start time. */
export type PlayerEntry =
  | (PlayerEntryBase & {
      readonly state: "playing";
      /** Timestamp this player most recently transitioned into "playing". */
      readonly startedPlayingAt: number;
    })
  | (PlayerEntryBase & { readonly state: Exclude<PlaybackState, "playing"> });
