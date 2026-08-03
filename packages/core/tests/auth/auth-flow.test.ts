import { describe, expect, it, vi } from "vitest";
import { AuthFlow } from "../../src/auth/auth-flow.js";
import { AuthTimeoutError } from "../../src/auth/auth-timeout-error.js";
import { LastfmApiError } from "../../src/lastfm-api/lastfm-error.js";
import type { LastfmSession } from "../../src/lastfm-api/types.js";

const SESSION: LastfmSession = {
  username: "someuser",
  sessionKey: "sk-123",
  isSubscriber: false,
};

function notAuthorizedYet(): never {
  throw new LastfmApiError(14, "This token has not been authorized");
}

describe("AuthFlow", () => {
  it("opens the auth URL built from a fresh token, then returns the session once approved", async () => {
    const openUrl = vi.fn();
    const client = {
      getAuthToken: vi.fn().mockResolvedValue("token-abc"),
      buildAuthUrl: vi.fn().mockReturnValue("https://www.last.fm/api/auth/?token=token-abc"),
      getSession: vi.fn().mockResolvedValue(SESSION),
    };
    const flow = new AuthFlow({
      client,
      openUrl,
      sleepImpl: vi.fn().mockResolvedValue(undefined),
    });

    const session = await flow.authenticate();

    expect(client.buildAuthUrl).toHaveBeenCalledWith("token-abc");
    expect(openUrl).toHaveBeenCalledWith("https://www.last.fm/api/auth/?token=token-abc");
    expect(client.getSession).toHaveBeenCalledWith("token-abc");
    expect(session).toEqual(SESSION);
  });

  it("silently retries while the user hasn't approved the token yet (error 14)", async () => {
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const getSession = vi
      .fn()
      .mockImplementationOnce(notAuthorizedYet)
      .mockImplementationOnce(notAuthorizedYet)
      .mockResolvedValueOnce(SESSION);
    const client = {
      getAuthToken: vi.fn().mockResolvedValue("token-abc"),
      buildAuthUrl: vi.fn().mockReturnValue("https://example.com/auth"),
      getSession,
    };
    const flow = new AuthFlow({ client, openUrl: vi.fn(), sleepImpl });

    const session = await flow.authenticate();

    expect(getSession).toHaveBeenCalledTimes(3);
    expect(sleepImpl).toHaveBeenCalledTimes(2);
    expect(session).toEqual(SESSION);
  });

  it("propagates a non-14 error immediately without retrying", async () => {
    const getSession = vi.fn().mockRejectedValue(new LastfmApiError(10, "Invalid API key"));
    const client = {
      getAuthToken: vi.fn().mockResolvedValue("token-abc"),
      buildAuthUrl: vi.fn().mockReturnValue("https://example.com/auth"),
      getSession,
    };
    const flow = new AuthFlow({ client, openUrl: vi.fn(), sleepImpl: vi.fn() });

    await expect(flow.authenticate()).rejects.toMatchObject({ code: 10 });
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("gives up with AuthTimeoutError once the deadline passes", async () => {
    let elapsedMs = 0;
    const client = {
      getAuthToken: vi.fn().mockResolvedValue("token-abc"),
      buildAuthUrl: vi.fn().mockReturnValue("https://example.com/auth"),
      getSession: vi.fn().mockImplementation(notAuthorizedYet),
    };
    const flow = new AuthFlow({
      client,
      openUrl: vi.fn(),
      pollIntervalMs: 1000,
      timeoutMs: 2500,
      sleepImpl: vi.fn().mockImplementation((ms: number) => {
        elapsedMs += ms;
        return Promise.resolve();
      }),
      now: () => elapsedMs,
    });

    await expect(flow.authenticate()).rejects.toBeInstanceOf(AuthTimeoutError);
  });
});
