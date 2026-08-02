import { describe, expect, it } from "vitest";
import { mapPayloadToPlaybackState } from "../../src/smtc/map-payload-to-playback-state.js";

describe("mapPayloadToPlaybackState", () => {
  it("maps 'Playing' to 'playing'", () => {
    expect(mapPayloadToPlaybackState({ playbackStatus: "Playing" })).toBe("playing");
  });

  it("maps 'Paused' to 'paused'", () => {
    expect(mapPayloadToPlaybackState({ playbackStatus: "Paused" })).toBe("paused");
  });

  it("maps 'Stopped'/'Closed'/'Opened'/'Changing'/missing to 'stopped'", () => {
    expect(mapPayloadToPlaybackState({ playbackStatus: "Stopped" })).toBe("stopped");
    expect(mapPayloadToPlaybackState({ playbackStatus: "Closed" })).toBe("stopped");
    expect(mapPayloadToPlaybackState({ playbackStatus: "Opened" })).toBe("stopped");
    expect(mapPayloadToPlaybackState({ playbackStatus: "Changing" })).toBe("stopped");
    expect(mapPayloadToPlaybackState({})).toBe("stopped");
    expect(mapPayloadToPlaybackState({ playbackStatus: null })).toBe("stopped");
  });
});
