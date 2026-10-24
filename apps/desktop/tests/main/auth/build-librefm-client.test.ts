import { describe, expect, it } from "vitest";
import { LastfmClient } from "@lastfm-scrobbler/core";
import { buildLibrefmClient } from "../../../src/main/auth/build-librefm-client.js";
import { createLibrefmAuthFlowClient } from "../../../src/main/auth/create-librefm-auth-flow-client.js";

const CREDENTIALS = { apiKey: "key", apiSecret: "secret" };

describe("buildLibrefmClient", () => {
  it("builds a Last.fm-protocol client pointed at Libre.fm, with no session by default", () => {
    const client = buildLibrefmClient(CREDENTIALS);

    expect(client).toBeInstanceOf(LastfmClient);
    expect(client.buildAuthUrl("tok")).toContain("libre.fm");
  });

  it("adds the session key when one is supplied", async () => {
    const client = buildLibrefmClient(CREDENTIALS, { sessionKey: "sk" });

    // A session-keyed client can sign write calls; an unkeyed one refuses to.
    const failure = await buildLibrefmClient(CREDENTIALS)
      .love({ artist: "A", track: "B" })
      .catch((error: unknown) => error);
    expect((failure as Error).message).toContain("requires a session key");
    expect(client).toBeInstanceOf(LastfmClient);
  });
});

describe("createLibrefmAuthFlowClient", () => {
  it("returns an unkeyed Libre.fm client for the login flow", () => {
    const client = createLibrefmAuthFlowClient(CREDENTIALS);

    expect(client.buildAuthUrl("tok")).toContain("libre.fm");
  });
});
