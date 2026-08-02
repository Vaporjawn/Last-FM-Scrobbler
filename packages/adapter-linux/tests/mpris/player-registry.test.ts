import { describe, expect, it } from "vitest";
import { PlayerRegistry } from "../../src/mpris/player-registry.js";
import type { TrackInfo } from "@lastfm-scrobbler/shared-types";

function track(title: string): TrackInfo {
  return { title, artist: "Artist", sourceApp: "test", isStream: false };
}

describe("PlayerRegistry", () => {
  it("reports stopped with no track when no players are known", () => {
    const registry = new PlayerRegistry();

    expect(registry.getActive()).toEqual({ track: null, state: "stopped" });
  });

  it("reports the only known player's state and track", () => {
    const registry = new PlayerRegistry();
    registry.update("org.mpris.MediaPlayer2.vlc", track("Song A"), "playing");

    expect(registry.getActive()).toEqual({ track: track("Song A"), state: "playing" });
  });

  it("prefers a playing player over a paused one, regardless of update order", () => {
    let now = 0;
    const registry = new PlayerRegistry({ now: () => now });

    now = 1;
    registry.update("org.mpris.MediaPlayer2.vlc", track("Paused Song"), "paused");
    now = 2;
    registry.update("org.mpris.MediaPlayer2.spotify", track("Playing Song"), "playing");

    expect(registry.getActive()).toEqual({ track: track("Playing Song"), state: "playing" });
  });

  it("when multiple players are playing, the most recently STARTED playing wins", () => {
    let now = 0;
    const registry = new PlayerRegistry({ now: () => now });

    now = 1;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "playing");
    now = 2;
    registry.update("org.mpris.MediaPlayer2.spotify", track("Spotify Song"), "playing");

    // spotify started playing later (at now=2) than vlc (at now=1) — spotify wins.
    expect(registry.getActive()).toEqual({ track: track("Spotify Song"), state: "playing" });
  });

  it("a track metadata change while already playing does not reset its 'started playing' time", () => {
    let now = 0;
    const registry = new PlayerRegistry({ now: () => now });

    now = 1;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "playing");
    now = 2;
    registry.update("org.mpris.MediaPlayer2.spotify", track("Spotify Song"), "playing");
    // vlc's track changes (still playing) at now=3 — this must NOT make vlc "more recently started" than spotify.
    now = 3;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song 2"), "playing");

    expect(registry.getActive()).toEqual({ track: track("Spotify Song"), state: "playing" });
  });

  it("re-entering playing (e.g. pause then resume) updates the 'started playing' time", () => {
    let now = 0;
    const registry = new PlayerRegistry({ now: () => now });

    now = 1;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "playing");
    now = 2;
    registry.update("org.mpris.MediaPlayer2.spotify", track("Spotify Song"), "playing");
    now = 3;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "paused");
    now = 4;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "playing"); // resumed later than spotify started

    expect(registry.getActive()).toEqual({ track: track("VLC Song"), state: "playing" });
  });

  it("when nothing is playing, falls back to the most recently changed player", () => {
    let now = 0;
    const registry = new PlayerRegistry({ now: () => now });

    now = 1;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "paused");
    now = 2;
    registry.update("org.mpris.MediaPlayer2.spotify", track("Spotify Song"), "stopped");

    expect(registry.getActive()).toEqual({ track: track("Spotify Song"), state: "stopped" });
  });

  it("remove() drops a player from consideration entirely", () => {
    let now = 0;
    const registry = new PlayerRegistry({ now: () => now });

    now = 1;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "playing");
    now = 2;
    registry.update("org.mpris.MediaPlayer2.spotify", track("Spotify Song"), "playing");
    registry.remove("org.mpris.MediaPlayer2.spotify");

    expect(registry.getActive()).toEqual({ track: track("VLC Song"), state: "playing" });
  });

  it("removing the only known player returns to the empty/stopped state", () => {
    const registry = new PlayerRegistry();
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "playing");
    registry.remove("org.mpris.MediaPlayer2.vlc");

    expect(registry.getActive()).toEqual({ track: null, state: "stopped" });
  });

  it("removing an unknown bus name is a harmless no-op", () => {
    const registry = new PlayerRegistry();
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "playing");

    expect(() => {
      registry.remove("org.mpris.MediaPlayer2.unknown");
    }).not.toThrow();
    expect(registry.getActive().track).toEqual(track("VLC Song"));
  });

  it("getActiveBusName() returns null when no players are known", () => {
    const registry = new PlayerRegistry();

    expect(registry.getActiveBusName()).toBeNull();
  });

  it("getActiveBusName() identifies which bus name backs the active snapshot", () => {
    let now = 0;
    const registry = new PlayerRegistry({ now: () => now });

    now = 1;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "paused");
    now = 2;
    registry.update("org.mpris.MediaPlayer2.spotify", track("Spotify Song"), "playing");

    expect(registry.getActiveBusName()).toBe("org.mpris.MediaPlayer2.spotify");
  });

  it("does not bump 'last changed' time on a no-op update with identical track and state", () => {
    let now = 0;
    const registry = new PlayerRegistry({ now: () => now });

    now = 1;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "paused");
    now = 2;
    registry.update("org.mpris.MediaPlayer2.spotify", track("Spotify Song"), "paused");
    // Redundant no-op update to vlc — must not make it "more recently changed" than spotify.
    now = 3;
    registry.update("org.mpris.MediaPlayer2.vlc", track("VLC Song"), "paused");

    expect(registry.getActive()).toEqual({ track: track("Spotify Song"), state: "paused" });
  });
});
