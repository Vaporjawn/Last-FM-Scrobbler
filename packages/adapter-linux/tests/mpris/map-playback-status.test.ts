import { describe, expect, it } from "vitest";
import { mapPlaybackStatus } from "../../src/mpris/map-playback-status.js";

describe("mapPlaybackStatus", () => {
  it("maps 'Playing' to 'playing'", () => {
    expect(mapPlaybackStatus("Playing")).toBe("playing");
  });

  it("maps 'Paused' to 'paused'", () => {
    expect(mapPlaybackStatus("Paused")).toBe("paused");
  });

  it("maps 'Stopped' to 'stopped'", () => {
    expect(mapPlaybackStatus("Stopped")).toBe("stopped");
  });

  it("maps anything unrecognized (including undefined) to 'stopped'", () => {
    expect(mapPlaybackStatus(undefined)).toBe("stopped");
    expect(mapPlaybackStatus("")).toBe("stopped");
    expect(mapPlaybackStatus("Buffering")).toBe("stopped");
  });
});
