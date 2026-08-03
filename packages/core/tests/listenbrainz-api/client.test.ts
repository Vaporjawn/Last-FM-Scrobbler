import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { ListenBrainzClient } from "../../src/listenbrainz-api/client.js";
import { ListenBrainzApiError } from "../../src/listenbrainz-api/listenbrainz-error.js";

const TOKEN = "test-token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ListenBrainzClient", () => {
  let fetchMock: Mock<typeof fetch>;
  let client: ListenBrainzClient;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    client = new ListenBrainzClient({ token: TOKEN, fetchImpl: fetchMock });
  });

  describe("updateNowPlaying", () => {
    it("submits a playing_now listen with no listened_at", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

      await client.updateNowPlaying({ artist: "Radiohead", track: "Idioteque", album: "Kid A" });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.listenbrainz.org/1/submit-listens");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>).authorization).toBe(`Token ${TOKEN}`);
      const body = JSON.parse(init.body as string) as {
        listen_type: string;
        payload: { listened_at?: number; track_metadata: Record<string, unknown> }[];
      };
      expect(body.listen_type).toBe("playing_now");
      expect(body.payload).toHaveLength(1);
      expect(body.payload[0]?.listened_at).toBeUndefined();
      expect(body.payload[0]?.track_metadata).toEqual({
        artist_name: "Radiohead",
        track_name: "Idioteque",
        release_name: "Kid A",
      });
    });
  });

  describe("scrobble", () => {
    it("submits a batch as single listens with listened_at timestamps", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

      const result = await client.scrobble([
        { artist: "A", track: "B", timestamp: 1000 },
        { artist: "C", track: "D", timestamp: 2000, album: "E" },
      ]);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.listenbrainz.org/1/submit-listens");
      const body = JSON.parse(init.body as string) as {
        listen_type: string;
        payload: { listened_at?: number; track_metadata: Record<string, unknown> }[];
      };
      expect(body.listen_type).toBe("single");
      expect(body.payload).toEqual([
        { listened_at: 1000, track_metadata: { artist_name: "A", track_name: "B" } },
        {
          listened_at: 2000,
          track_metadata: { artist_name: "C", track_name: "D", release_name: "E" },
        },
      ]);

      expect(result).toEqual({
        accepted: 2,
        ignored: 0,
        results: [
          { track: "B", ignoredCode: 0, retryable: false },
          { track: "D", ignoredCode: 0, retryable: false },
        ],
      });
    });

    it("returns an empty result for an empty batch without making a request", async () => {
      const result = await client.scrobble([]);

      expect(result).toEqual({ accepted: 0, ignored: 0, results: [] });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws ListenBrainzApiError with the HTTP status and a parsed message on failure", async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse({ error: "Invalid token" }, 401)),
      );

      await expect(
        client.scrobble([{ artist: "A", track: "B", timestamp: 1 }]),
      ).rejects.toMatchObject({ code: 401, message: "Invalid token" });
      await expect(
        client.scrobble([{ artist: "A", track: "B", timestamp: 1 }]),
      ).rejects.toBeInstanceOf(ListenBrainzApiError);
    });

    it("rejects a batch larger than ListenBrainz's documented per-request limit", async () => {
      const oversized = Array.from({ length: 1001 }, (_, i) => ({
        artist: "A",
        track: `Track ${i}`,
        timestamp: i,
      }));

      await expect(client.scrobble(oversized)).rejects.toThrow(/1001/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("validateToken", () => {
    it("reports a valid token's username", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ code: 200, message: "Token valid.", valid: true, user_name: "someuser" }),
      );

      const result = await client.validateToken("candidate-token");

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe("https://api.listenbrainz.org/1/validate-token?token=candidate-token");
      expect(result).toEqual({ valid: true, username: "someuser" });
    });

    it("reports an invalid token without a username, from a 200 response", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ code: 200, message: "Token invalid.", valid: false }),
      );

      const result = await client.validateToken("bad-token");

      expect(result).toEqual({ valid: false });
    });
  });
});
