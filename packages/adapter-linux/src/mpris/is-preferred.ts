import { type PlayerEntry } from "./player-entry.js";

/** Whether `entry` should replace `incumbent` as the active player (see ADR 0005). */
export function isPreferred(entry: PlayerEntry, incumbent: PlayerEntry): boolean {
  if (entry.state === "playing") {
    return incumbent.state !== "playing" || entry.startedPlayingAt > incumbent.startedPlayingAt;
  }
  if (incumbent.state === "playing") {
    return false;
  }
  return entry.lastChangedAt > incumbent.lastChangedAt;
}
