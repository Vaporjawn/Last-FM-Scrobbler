import type { PlaybackState, TrackInfo } from "@lastfm-scrobbler/shared-types";

export interface ActiveSnapshot {
  readonly track: TrackInfo | null;
  readonly state: PlaybackState;
}

export interface PlayerRegistryOptions {
  readonly now?: () => number;
}

interface PlayerEntryBase {
  readonly track: TrackInfo | null;
  /** Timestamp of the most recent genuine change to this player's track/state. */
  readonly lastChangedAt: number;
}

/** A discriminated union, so "currently playing" statically implies a known start time. */
type PlayerEntry =
  | (PlayerEntryBase & {
      readonly state: "playing";
      /** Timestamp this player most recently transitioned into "playing". */
      readonly startedPlayingAt: number;
    })
  | (PlayerEntryBase & { readonly state: Exclude<PlaybackState, "playing"> });

/** Whether `entry` should replace `incumbent` as the active player (see ADR 0005). */
function isPreferred(entry: PlayerEntry, incumbent: PlayerEntry): boolean {
  if (entry.state === "playing") {
    return incumbent.state !== "playing" || entry.startedPlayingAt > incumbent.startedPlayingAt;
  }
  if (incumbent.state === "playing") {
    return false;
  }
  return entry.lastChangedAt > incumbent.lastChangedAt;
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
