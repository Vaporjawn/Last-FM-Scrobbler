import { describe, expect, it } from "vitest";
import { deriveSourceAppFromBusName } from "../../src/mpris/derive-source-app-from-bus-name.js";

describe("deriveSourceAppFromBusName", () => {
  it("strips the org.mpris.MediaPlayer2. prefix", () => {
    expect(deriveSourceAppFromBusName("org.mpris.MediaPlayer2.spotify")).toBe("spotify");
  });

  it("strips a trailing .instanceN suffix per the MPRIS multi-instance convention", () => {
    expect(deriveSourceAppFromBusName("org.mpris.MediaPlayer2.chromium.instance7389")).toBe(
      "chromium",
    );
  });

  it("leaves multi-segment player names intact aside from the prefix/instance suffix", () => {
    expect(deriveSourceAppFromBusName("org.mpris.MediaPlayer2.plasma-browser-integration")).toBe(
      "plasma-browser-integration",
    );
  });

  it("returns the input unchanged if it doesn't match the expected MPRIS prefix", () => {
    expect(deriveSourceAppFromBusName("com.example.NotMpris")).toBe("com.example.NotMpris");
  });
});
