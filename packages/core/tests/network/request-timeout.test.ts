import { describe, expect, it, vi } from "vitest";
import { ListenBrainzClient } from "../../src/listenbrainz-api/client.js";
import { LastfmClient } from "../../src/lastfm-api/client.js";
import { fetchArtistImageUrl } from "../../src/artist-images/fetch-artist-image-url.js";
import { isNetworkError } from "../../src/network/is-network-error.js";
import {
  createTimeoutSignal,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "../../src/network/request-timeout.js";

/** A fetch that, like a stalled server, never answers on its own: it only ever settles
 * because the caller's abort signal fires. */
function stalledFetch(): typeof fetch {
  return vi.fn<typeof fetch>((_input, init) => {
    const signal = init?.signal;
    if (!signal) {
      return new Promise<Response>(() => undefined);
    }
    return new Promise<Response>((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        reject(signal.reason as Error);
      });
    });
  });
}

describe("request timeouts", () => {
  it("defaults to 30 seconds", () => {
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBe(30_000);
  });

  it("aborts a signal with a TimeoutError once the time is up", async () => {
    const signal = createTimeoutSignal(5);

    await new Promise((resolve) => {
      signal.addEventListener("abort", resolve);
    });

    expect((signal.reason as Error).name).toBe("TimeoutError");
  });

  describe("LastfmClient", () => {
    const base = { apiKey: "k", apiSecret: "s", sessionKey: "sk", timeoutMs: 5 };

    it("gives up on a stalled GET request", async () => {
      const client = new LastfmClient({ ...base, fetchImpl: stalledFetch() });

      const failure = await client.getFriends({ user: "alice" }).catch((error: unknown) => error);

      expect(isNetworkError(failure)).toBe(true);
    });

    it("gives up on a stalled signed POST request", async () => {
      const client = new LastfmClient({ ...base, fetchImpl: stalledFetch() });

      const failure = await client
        .scrobble([{ artist: "A", track: "T", timestamp: 1 }])
        .catch((error: unknown) => error);

      expect(isNetworkError(failure)).toBe(true);
    });

    it("sends every request with an abort signal even when no timeout is configured", async () => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ friends: { user: [] } })));
      const client = new LastfmClient({ apiKey: "k", apiSecret: "s", fetchImpl });

      await client.getFriends({ user: "alice" });

      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("ListenBrainzClient", () => {
    it("gives up on a stalled submission and a stalled token check", async () => {
      const client = new ListenBrainzClient({
        token: "t",
        timeoutMs: 5,
        fetchImpl: stalledFetch(),
      });

      const submit = await client
        .scrobble([{ artist: "A", track: "T", timestamp: 1 }])
        .catch((error: unknown) => error);
      const validate = await client.validateToken("t").catch((error: unknown) => error);

      expect(isNetworkError(submit)).toBe(true);
      expect(isNetworkError(validate)).toBe(true);
    });

    it("sends every request with an abort signal even when no timeout is configured", async () => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ valid: false })));
      const client = new ListenBrainzClient({ token: "t", fetchImpl });

      await client.validateToken("t");

      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("fetchArtistImageUrl", () => {
    it("resolves to no photo, instead of waiting forever, when Deezer stalls", async () => {
      await expect(fetchArtistImageUrl("Radiohead", stalledFetch(), 5)).resolves.toBeUndefined();
    });

    it("uses the default ceiling when none is given", async () => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ data: [] })));

      await fetchArtistImageUrl("Radiohead", fetchImpl);

      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });
  });

  it("classifies a TimeoutError as a network error but not an ordinary failure", () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");

    expect(isNetworkError(timeout)).toBe(true);
    expect(isNetworkError(new Error("boom"))).toBe(false);
  });
});
