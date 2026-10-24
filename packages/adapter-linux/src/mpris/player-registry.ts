import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";
import { type PlayerEntry } from "./player-entry.js";
import { tracksEqual } from "./tracks-equal.js";
import { isPreferred } from "./is-preferred.js";

export interface ActiveSnapshot {
  readonly track: TrackInfo | null;
  readonly state: PlaybackState;
}
export interface PlayerRegistryOptions {
  readonly now?: () => number;
}
/**
 * Implements docs/adr/0005-multi-source-and-track-identity-policy.md's multi-source
 * arbitration: "an adapter reports whichever session is actively Playing and
 * most-recently-changed; if several are simultaneously Playing, the most recently
 * _started_ one wins." Pure state machine — no D-Bus dependency — so this is testable
 * without a real (or fake) bus in the loop; `create-linux-playback-source.ts` is the
 * thin D-Bus-facing layer that feeds it.
 */
export class PlayerRegistry {
  private readonly now: () => number;
  private readonly players = new Map<string, PlayerEntry>();

  constructor(options: PlayerRegistryOptions = {}) {
    this.now = options.now ?? (() => Date.now() / 1000);
  }

  update(busName: string, track: TrackInfo | null, state: PlaybackState): void {
    const existing = this.players.get(busName);
    const nowSec = this.now();

    if (existing && tracksEqual(existing.track, track) && existing.state === state) {
      return;
    }

    if (state === "playing") {
      this.players.set(busName, {
        track,
        state,
        lastChangedAt: nowSec,
        startedPlayingAt: existing?.state === "playing" ? existing.startedPlayingAt : nowSec,
      });
    } else {
      this.players.set(busName, { track, state, lastChangedAt: nowSec });
    }
  }

  remove(busName: string): void {
    this.players.delete(busName);
  }

  /** Forgets every player — for when the whole source is torn down. */
  clear(): void {
    this.players.clear();
  }

  getActive(): ActiveSnapshot {
    const best = this.findActiveEntry();
    if (!best) {
      return { track: null, state: "stopped" };
    }
    return { track: best[1].track, state: best[1].state };
  }

  /** The bus name backing `getActive()`'s result, or `null` if no player is known. */
  getActiveBusName(): string | null {
    return this.findActiveEntry()?.[0] ?? null;
  }

  private findActiveEntry(): [string, PlayerEntry] | undefined {
    let best: [string, PlayerEntry] | undefined;

    for (const candidate of this.players.entries()) {
      if (best === undefined || isPreferred(candidate[1], best[1])) {
        best = candidate;
      }
    }

    return best;
  }
}
