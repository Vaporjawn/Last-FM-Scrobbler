import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";

export interface ActiveSnapshot {
  readonly track: TrackInfo | null;
  readonly state: PlaybackState;
}

export interface PlayerRegistryOptions {
  readonly now?: () => number;
}

interface PlayerEntry {
  track: TrackInfo | null;
  state: PlaybackState;
  /** Timestamp of the most recent genuine change to this player's track/state. */
  lastChangedAt: number;
  /** Timestamp this player most recently transitioned into "playing"; undefined if never, or not currently playing. */
  startedPlayingAt: number | undefined;
}

function tracksEqual(a: TrackInfo | null, b: TrackInfo | null): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return (
    a.title === b.title &&
    a.artist === b.artist &&
    a.album === b.album &&
    a.albumArtist === b.albumArtist &&
    a.durationSec === b.durationSec &&
    a.sourceApp === b.sourceApp &&
    a.isStream === b.isStream
  );
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

    const startedPlayingAt =
      state === "playing" && existing?.state !== "playing" ? nowSec : existing?.startedPlayingAt;

    this.players.set(busName, {
      track,
      state,
      lastChangedAt: nowSec,
      startedPlayingAt: state === "playing" ? startedPlayingAt : undefined,
    });
  }

  remove(busName: string): void {
    this.players.delete(busName);
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
    let bestIsPlaying = false;

    for (const candidate of this.players.entries()) {
      const entry = candidate[1];
      const entryIsPlaying = entry.state === "playing";

      if (best === undefined) {
        best = candidate;
        bestIsPlaying = entryIsPlaying;
        continue;
      }

      if (entryIsPlaying && !bestIsPlaying) {
        best = candidate;
        bestIsPlaying = true;
        continue;
      }
      if (!entryIsPlaying && bestIsPlaying) {
        continue;
      }

      if (entryIsPlaying && bestIsPlaying) {
        if ((entry.startedPlayingAt ?? 0) > (best[1].startedPlayingAt ?? 0)) {
          best = candidate;
        }
      } else if (entry.lastChangedAt > best[1].lastChangedAt) {
        best = candidate;
      }
    }

    return best;
  }
}
