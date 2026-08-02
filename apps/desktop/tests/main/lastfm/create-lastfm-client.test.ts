import { describe, expect, it } from "vitest";
import { LastfmClient } from "@lastfm-scrobbler/core";
import { createLastfmClient } from "../../../src/main/lastfm/create-lastfm-client.js";

describe("createLastfmClient", () => {
  it("returns a LastfmClient when both LASTFM_API_KEY and LASTFM_API_SECRET are set", () => {
    const client = createLastfmClient({
      env: { LASTFM_API_KEY: "key123", LASTFM_API_SECRET: "secret456" },
    });

    expect(client).toBeInstanceOf(LastfmClient);
  });

  it("returns undefined when LASTFM_API_KEY is missing", () => {
    const client = createLastfmClient({ env: { LASTFM_API_SECRET: "secret456" } });

    expect(client).toBeUndefined();
  });

  it("returns undefined when LASTFM_API_SECRET is missing", () => {
    const client = createLastfmClient({ env: { LASTFM_API_KEY: "key123" } });

    expect(client).toBeUndefined();
  });

  it("returns undefined when neither is set", () => {
    const client = createLastfmClient({ env: {} });

    expect(client).toBeUndefined();
  });

  it("passes a session key through when provided", () => {
    const client = createLastfmClient({
      env: { LASTFM_API_KEY: "key123", LASTFM_API_SECRET: "secret456" },
      sessionKey: "user-session-key",
    });

    expect(client).toBeInstanceOf(LastfmClient);
  });
});
