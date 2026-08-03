import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { LastfmClient } from "../../src/lastfm-api/client.js";
import { LastfmApiError } from "../../src/lastfm-api/lastfm-error.js";
import { signRequest } from "../../src/lastfm-api/sign-request.js";

const API_KEY = "test-api-key";
const API_SECRET = "test-secret";
const SESSION_KEY = "test-session-key";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("LastfmClient", () => {
  let fetchMock: Mock<typeof fetch>;
  let client: LastfmClient;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    client = new LastfmClient({
      apiKey: API_KEY,
      apiSecret: API_SECRET,
      sessionKey: SESSION_KEY,
      fetchImpl: fetchMock,
    });
  });

  describe("request building", () => {
    it("signs auth.getToken and sends it as a GET with format=json", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ token: "abc123" }));

      await client.getAuthToken();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
      const parsed = new URL(url);
      expect(parsed.searchParams.get("method")).toBe("auth.getToken");
      expect(parsed.searchParams.get("api_key")).toBe(API_KEY);
      expect(parsed.searchParams.get("format")).toBe("json");
      expect(parsed.searchParams.get("api_sig")).toBe(
        signRequest({ method: "auth.getToken", api_key: API_KEY }, API_SECRET),
      );
      expect(init?.method ?? "GET").toBe("GET");
    });

    it("sends track.updateNowPlaying as a signed POST with form-encoded params", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ nowplaying: {} }));

      await client.updateNowPlaying({ artist: "Radiohead", track: "Idioteque" });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://ws.audioscrobbler.com/2.0/");
      expect(init.method).toBe("POST");
      const body = new URLSearchParams(init.body as string);
      expect(body.get("method")).toBe("track.updateNowPlaying");
      expect(body.get("artist")).toBe("Radiohead");
      expect(body.get("track")).toBe("Idioteque");
      expect(body.get("sk")).toBe(SESSION_KEY);
      expect(body.get("api_sig")).toBe(
        signRequest(
          {
            method: "track.updateNowPlaying",
            artist: "Radiohead",
            track: "Idioteque",
            api_key: API_KEY,
            sk: SESSION_KEY,
          },
          API_SECRET,
        ),
      );
    });

    it("does not sign public read methods like user.getRecentTracks", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ recenttracks: { track: [] } }));

      await client.getRecentTracks({ user: "someuser" });

      const [url] = fetchMock.mock.calls[0] as [string];
      const parsed = new URL(url);
      expect(parsed.searchParams.get("api_sig")).toBeNull();
      expect(parsed.searchParams.get("sk")).toBeNull();
    });

    it("throws LastfmApiError with the code and message from an error response", async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          jsonResponse({ error: 9, message: "Invalid session key - Please re-authenticate" }),
        ),
      );

      await expect(client.updateNowPlaying({ artist: "A", track: "B" })).rejects.toMatchObject({
        code: 9,
        message: "Invalid session key - Please re-authenticate",
      });
      await expect(client.updateNowPlaying({ artist: "A", track: "B" })).rejects.toBeInstanceOf(
        LastfmApiError,
      );
    });
  });

  describe("auth.getSession", () => {
    it("parses the session key, username, and subscriber flag", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ session: { name: "someuser", key: "sk123", subscriber: 0 } }),
      );

      const session = await client.getSession("token123");

      expect(session).toEqual({ username: "someuser", sessionKey: "sk123", isSubscriber: false });
    });
  });

  describe("buildAuthUrl", () => {
    it("defaults to Last.fm's own authorization page", () => {
      const url = new URL(client.buildAuthUrl("tok"));

      expect(url.origin + url.pathname).toBe("https://www.last.fm/api/auth/");
      expect(url.searchParams.get("api_key")).toBe(API_KEY);
      expect(url.searchParams.get("token")).toBe("tok");
    });

    it("uses a configured authUrl instead, for a different Audioscrobbler-protocol service", () => {
      const librefmClient = new LastfmClient({
        apiKey: API_KEY,
        apiSecret: API_SECRET,
        authUrl: "https://libre.fm/api/auth/",
      });

      const url = new URL(librefmClient.buildAuthUrl("tok"));

      expect(url.origin + url.pathname).toBe("https://libre.fm/api/auth/");
    });
  });

  describe("track.scrobble", () => {
    it("submits a batch using array-index parameter notation", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          scrobbles: {
            "@attr": { accepted: 2, ignored: 0 },
            scrobble: [
              { track: { "#text": "Idioteque" }, ignoredMessage: { code: "0" } },
              { track: { "#text": "Nude" }, ignoredMessage: { code: "0" } },
            ],
          },
        }),
      );

      const result = await client.scrobble([
        { artist: "Radiohead", track: "Idioteque", timestamp: 1_700_000_000 },
        { artist: "Radiohead", track: "Nude", timestamp: 1_700_000_300 },
      ]);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = new URLSearchParams(init.body as string);
      expect(body.get("artist[0]")).toBe("Radiohead");
      expect(body.get("track[0]")).toBe("Idioteque");
      expect(body.get("timestamp[0]")).toBe("1700000000");
      expect(body.get("artist[1]")).toBe("Radiohead");
      expect(body.get("track[1]")).toBe("Nude");
      expect(result.accepted).toBe(2);
      expect(result.ignored).toBe(0);
    });

    it("reports per-scrobble ignore reasons", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          scrobbles: {
            "@attr": { accepted: 0, ignored: 1 },
            scrobble: { track: { "#text": "Idioteque" }, ignoredMessage: { code: "4" } },
          },
        }),
      );

      const result = await client.scrobble([
        { artist: "Radiohead", track: "Idioteque", timestamp: 9_999_999_999 },
      ]);

      expect(result.accepted).toBe(0);
      expect(result.ignored).toBe(1);
      expect(result.results[0]).toMatchObject({ ignoredCode: 4, retryable: false });
    });

    it("rejects a batch larger than 50 scrobbles without making a request", async () => {
      const tooMany = Array.from({ length: 51 }, (_, i) => ({
        artist: "A",
        track: `T${i}`,
        timestamp: i,
      }));

      await expect(client.scrobble(tooMany)).rejects.toThrow(/50/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("track.love / track.unlove / track.addTags", () => {
    it("loves a track", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));
      await client.love({ artist: "Radiohead", track: "Idioteque" });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = new URLSearchParams(init.body as string);
      expect(body.get("method")).toBe("track.love");
    });

    it("unloves a track", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));
      await client.unlove({ artist: "Radiohead", track: "Idioteque" });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = new URLSearchParams(init.body as string);
      expect(body.get("method")).toBe("track.unlove");
    });

    it("adds comma-separated tags to a track", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));
      await client.addTags({
        artist: "Radiohead",
        track: "Idioteque",
        tags: ["electronic", "2000s"],
      });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = new URLSearchParams(init.body as string);
      expect(body.get("tags")).toBe("electronic,2000s");
    });
  });

  describe("read methods", () => {
    it("parses user.getRecentTracks, distinguishing the now-playing track", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          recenttracks: {
            track: [
              {
                // extended=1 shape: artist.name, plus image + loved.
                artist: { name: "Radiohead" },
                name: "Idioteque",
                album: { "#text": "Kid A" },
                "@attr": { nowplaying: "true" },
                image: [
                  { size: "small", "#text": "" },
                  { size: "large", "#text": "https://lastfm.freetls.fastly.net/i/u/174s/idioteque.png" },
                ],
                loved: "1",
              },
              {
                // Non-extended fallback shape (artist["#text"]) and no image/loved at
                // all — both should be handled defensively, defaulting loved to false.
                artist: { "#text": "Radiohead" },
                name: "Nude",
                album: { "#text": "In Rainbows" },
                date: { uts: "1700000000" },
              },
            ],
          },
        }),
      );

      const result = await client.getRecentTracks({ user: "someuser" });

      expect(result).toEqual([
        {
          artist: "Radiohead",
          track: "Idioteque",
          album: "Kid A",
          nowPlaying: true,
          imageUrl: "https://lastfm.freetls.fastly.net/i/u/174s/idioteque.png",
          loved: true,
        },
        {
          artist: "Radiohead",
          track: "Nude",
          album: "In Rainbows",
          nowPlaying: false,
          timestamp: 1_700_000_000,
          loved: false,
        },
      ]);
    });

    it("requests user.getRecentTracks with extended=1, so loved status and real artwork are included", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ recenttracks: { track: [] } }));

      await client.getRecentTracks({ user: "someuser" });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(new URL(url).searchParams.get("extended")).toBe("1");
    });

    it("forwards page for user.getRecentTracks", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ recenttracks: { track: [] } }));

      await client.getRecentTracks({ user: "someuser", limit: 20, page: 2 });

      const [url] = fetchMock.mock.calls[0] as [string];
      const params = new URL(url).searchParams;
      expect(params.get("page")).toBe("2");
      expect(params.get("limit")).toBe("20");
    });

    it("omits page for user.getRecentTracks when not given, same as before this parameter existed", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ recenttracks: { track: [] } }));

      await client.getRecentTracks({ user: "someuser" });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(new URL(url).searchParams.has("page")).toBe(false);
    });

    it("parses user.getTopArtists", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          topartists: {
            artist: [{ name: "Radiohead", playcount: "42" }],
          },
        }),
      );
      const result = await client.getTopArtists({ user: "someuser", period: "7day" });
      expect(result).toEqual([{ name: "Radiohead", playCount: 42 }]);
    });

    it("parses user.getTopTracks, deliberately omitting the shared-placeholder image field", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          toptracks: {
            track: [
              {
                name: "Idioteque",
                artist: { name: "Radiohead" },
                playcount: "42",
                image: [{ size: "extralarge", "#text": "https://.../placeholder.png" }],
              },
            ],
          },
        }),
      );
      const result = await client.getTopTracks({ user: "someuser", period: "7day" });
      expect(result).toEqual([{ name: "Idioteque", artist: "Radiohead", playCount: 42 }]);
    });

    it("normalizes a single-track user.getTopTracks response into an array", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          toptracks: { track: { name: "Idioteque", artist: { name: "Radiohead" }, playcount: "1" } },
        }),
      );
      const result = await client.getTopTracks({ user: "someuser" });
      expect(result).toEqual([{ name: "Idioteque", artist: "Radiohead", playCount: 1 }]);
    });

    it("forwards period/limit for user.getTopTracks", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ toptracks: { track: [] } }));

      await client.getTopTracks({ user: "someuser", period: "1month", limit: 5 });

      const [url] = fetchMock.mock.calls[0] as [string];
      const params = new URL(url).searchParams;
      expect(params.get("period")).toBe("1month");
      expect(params.get("limit")).toBe("5");
    });

    it("parses user.getTopAlbums, including its real per-album art", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          topalbums: {
            album: [
              {
                name: "In Rainbows",
                artist: { name: "Radiohead" },
                playcount: "42",
                image: [
                  { size: "small", "#text": "https://.../small.jpg" },
                  { size: "extralarge", "#text": "https://.../large.jpg" },
                ],
              },
            ],
          },
        }),
      );
      const result = await client.getTopAlbums({ user: "someuser", period: "7day" });
      expect(result).toEqual([
        {
          name: "In Rainbows",
          artist: "Radiohead",
          playCount: 42,
          imageUrl: "https://.../large.jpg",
        },
      ]);
    });

    it("omits imageUrl for a user.getTopAlbums entry with no art on file", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          topalbums: {
            album: [{ name: "No Art", artist: { name: "Someone" }, playcount: "1", image: [] }],
          },
        }),
      );
      const result = await client.getTopAlbums({ user: "someuser" });
      expect(result).toEqual([{ name: "No Art", artist: "Someone", playCount: 1 }]);
    });

    it("normalizes a single-album user.getTopAlbums response into an array", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          topalbums: { album: { name: "In Rainbows", artist: { name: "Radiohead" }, playcount: "1" } },
        }),
      );
      const result = await client.getTopAlbums({ user: "someuser" });
      expect(result).toEqual([{ name: "In Rainbows", artist: "Radiohead", playCount: 1 }]);
    });

    it("forwards period/limit for user.getTopAlbums", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ topalbums: { album: [] } }));

      await client.getTopAlbums({ user: "someuser", period: "12month", limit: 8 });

      const [url] = fetchMock.mock.calls[0] as [string];
      const params = new URL(url).searchParams;
      expect(params.get("period")).toBe("12month");
      expect(params.get("limit")).toBe("8");
    });

    it("parses user.getFriends", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ friends: { user: [{ name: "afriend", realname: "A Friend" }] } }),
      );
      const result = await client.getFriends({ user: "someuser" });
      expect(result).toEqual([{ username: "afriend", realName: "A Friend", isSubscriber: false }]);
    });

    it("parses each friend's self-reported location out of user.getFriends", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          friends: {
            user: [
              { name: "afriend", country: "United Kingdom" },
              { name: "nolocation", country: "" },
            ],
          },
        }),
      );
      const result = await client.getFriends({ user: "someuser" });
      expect(result).toEqual([
        { username: "afriend", location: "United Kingdom", isSubscriber: false },
        { username: "nolocation", isSubscriber: false },
      ]);
    });

    it("parses each friend's own avatar photo out of user.getFriends", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          friends: {
            user: [
              {
                name: "afriend",
                image: [
                  { size: "small", "#text": "https://example.com/34s.png" },
                  { size: "extralarge", "#text": "https://example.com/300x300.png" },
                ],
              },
              {
                name: "nophoto",
                image: [
                  { size: "small", "#text": "" },
                  { size: "extralarge", "#text": "" },
                ],
              },
            ],
          },
        }),
      );
      const result = await client.getFriends({ user: "someuser" });
      expect(result).toEqual([
        { username: "afriend", avatarUrl: "https://example.com/300x300.png", isSubscriber: false },
        { username: "nophoto", isSubscriber: false },
      ]);
    });

    it("parses each friend's Last.fm Pro subscriber status out of user.getFriends", async () => {
      // Verified live against the real API (user.getfriends, format=json): each user
      // object in the response includes its own top-level "subscriber": "0"/"1" field
      // directly — no separate per-friend lookup needed, same as avatarUrl above.
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          friends: {
            user: [
              { name: "prouser", subscriber: "1" },
              { name: "freeuser", subscriber: "0" },
            ],
          },
        }),
      );
      const result = await client.getFriends({ user: "someuser" });
      expect(result).toEqual([
        { username: "prouser", isSubscriber: true },
        { username: "freeuser", isSubscriber: false },
      ]);
    });

    it("parses user.getInfo, preferring the largest available avatar size", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          user: {
            name: "someuser",
            realname: "Some User",
            image: [
              { size: "small", "#text": "https://example.com/34s.png" },
              { size: "medium", "#text": "https://example.com/64s.png" },
              { size: "large", "#text": "https://example.com/174s.png" },
              { size: "extralarge", "#text": "https://example.com/300x300.png" },
            ],
          },
        }),
      );
      const result = await client.getUserInfo({ user: "someuser" });
      expect(result).toEqual({
        username: "someuser",
        realName: "Some User",
        avatarUrl: "https://example.com/300x300.png",
        isSubscriber: false,
      });
    });

    it("user.getInfo omits avatarUrl when every image size is blank (no photo set)", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          user: {
            name: "someuser",
            image: [
              { size: "small", "#text": "" },
              { size: "medium", "#text": "" },
              { size: "large", "#text": "" },
              { size: "extralarge", "#text": "" },
            ],
          },
        }),
      );
      const result = await client.getUserInfo({ user: "someuser" });
      expect(result).toEqual({ username: "someuser", isSubscriber: false });
    });

    it("user.getInfo omits avatarUrl when the image array is missing entirely", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ user: { name: "someuser" } }));
      const result = await client.getUserInfo({ user: "someuser" });
      expect(result).toEqual({ username: "someuser", isSubscriber: false });
    });

    it("user.getInfo parses totalScrobbles and registeredAt from a realistic response", async () => {
      // Shape verified live against the real API (curl user.getinfo, Last.fm's own
      // documented public sample key against their RJ test account) — playcount and
      // registered.unixtime are both real, populated fields on a real account.
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          user: {
            name: "RJ",
            realname: "Richard Jones ",
            playcount: "151481",
            registered: { unixtime: "1037793040", "#text": 1037793040 },
          },
        }),
      );
      const result = await client.getUserInfo({ user: "RJ" });
      expect(result).toEqual({
        username: "RJ",
        realName: "Richard Jones ",
        totalScrobbles: 151481,
        registeredAt: 1037793040,
        isSubscriber: false,
      });
    });

    it("user.getInfo omits totalScrobbles/registeredAt when both fields are absent", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ user: { name: "someuser" } }));
      const result = await client.getUserInfo({ user: "someuser" });
      expect(result).toEqual({ username: "someuser", isSubscriber: false });
      expect(result.totalScrobbles).toBeUndefined();
      expect(result.registeredAt).toBeUndefined();
    });

    it("user.getInfo omits totalScrobbles/registeredAt when they're present but non-numeric", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          user: { name: "someuser", playcount: "not-a-number", registered: { unixtime: "also-not-a-number" } },
        }),
      );
      const result = await client.getUserInfo({ user: "someuser" });
      expect(result).toEqual({ username: "someuser", isSubscriber: false });
    });

    it("user.getInfo parses country and subscriber from a realistic response", async () => {
      // Shape verified live against the real API (curl user.getinfo against Last.fm's
      // RJ test account): the response includes top-level "country" and
      // "subscriber": "0"/"1" fields directly, same as user.getFriends.
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          user: { name: "RJ", country: "United Kingdom", subscriber: "1" },
        }),
      );
      const result = await client.getUserInfo({ user: "RJ" });
      expect(result).toEqual({
        username: "RJ",
        location: "United Kingdom",
        isSubscriber: true,
      });
    });

    it("user.getInfo omits location and defaults isSubscriber to false when both are absent", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ user: { name: "someuser" } }));
      const result = await client.getUserInfo({ user: "someuser" });
      expect(result.location).toBeUndefined();
      expect(result.isSubscriber).toBe(false);
    });

    it("parses user.getLovedTracks's total count", async () => {
      // Shape verified live against the real API (curl user.getlovedtracks against
      // Last.fm's RJ test account, limit=1): lovedtracks["@attr"].total is a real,
      // populated field alongside the (here, irrelevant) track list itself.
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          lovedtracks: {
            track: [],
            "@attr": { user: "RJ", totalPages: "700", page: "1", perPage: "1", total: "700" },
          },
        }),
      );

      const result = await client.getLovedTracksCount({ user: "RJ" });

      expect(result).toBe(700);
      const [url] = fetchMock.mock.calls[0] as [string];
      const parsed = new URL(url);
      expect(parsed.searchParams.get("method")).toBe("user.getLovedTracks");
      expect(parsed.searchParams.get("user")).toBe("RJ");
      expect(parsed.searchParams.get("limit")).toBe("1");
    });

    it("returns 0 when user.getLovedTracks's total is missing or non-numeric", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ lovedtracks: { track: [], "@attr": { total: "not-a-number" } } }),
      );

      const result = await client.getLovedTracksCount({ user: "someuser" });

      expect(result).toBe(0);
    });

    it("parses artist.getInfo", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          artist: {
            name: "Radiohead",
            bio: { summary: "An English rock band." },
            stats: { listeners: "100", playcount: "200" },
          },
        }),
      );
      const result = await client.getArtistInfo({ artist: "Radiohead" });
      expect(result).toEqual({
        name: "Radiohead",
        bioSummary: "An English rock band.",
        listeners: 100,
        playCount: 200,
      });
    });

    it("getArtistImageUrl returns the largest real photo when Last.fm actually has one", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          artist: {
            name: "Some Rare Artist",
            image: [
              { size: "small", "#text": "https://lastfm.freetls.fastly.net/i/u/small/real.jpg" },
              { size: "extralarge", "#text": "https://lastfm.freetls.fastly.net/i/u/xl/real.jpg" },
            ],
          },
        }),
      );
      const result = await client.getArtistImageUrl("Some Rare Artist");
      expect(result).toBe("https://lastfm.freetls.fastly.net/i/u/xl/real.jpg");
    });

    it("getArtistImageUrl returns undefined when every size is Last.fm's own shared placeholder", async () => {
      // Verified live against the real API: this is the actual, current behavior for
      // the overwhelming majority of artists — see LASTFM_ARTIST_IMAGE_PLACEHOLDER_HASH's
      // docstring and ArtistInfo's in types.ts.
      const placeholderUrl =
        "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.jpg";
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          artist: {
            name: "Radiohead",
            image: [
              { size: "small", "#text": placeholderUrl },
              { size: "extralarge", "#text": placeholderUrl },
            ],
          },
        }),
      );
      const result = await client.getArtistImageUrl("Radiohead");
      expect(result).toBeUndefined();
    });

    it("getArtistImageUrl returns undefined when the image array is missing entirely", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ artist: { name: "Radiohead" } }));
      const result = await client.getArtistImageUrl("Radiohead");
      expect(result).toBeUndefined();
    });

    it("getArtistImageUrl propagates a LastfmApiError on request failure, same as getArtistInfo", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error: 6, message: "The artist you supplied could not be found" }),
      );
      await expect(client.getArtistImageUrl("zzznonexistent")).rejects.toThrow(LastfmApiError);
    });

    it("parses artist.getSimilar", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ similarartists: { artist: [{ name: "Thom Yorke", match: "0.9" }] } }),
      );
      const result = await client.getSimilarArtists({ artist: "Radiohead" });
      expect(result).toEqual([{ name: "Thom Yorke", match: 0.9 }]);
    });

    it("includes userPlayCount in artist.getInfo when a username is given", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          artist: {
            name: "Radiohead",
            stats: { listeners: "100", playcount: "200", userplaycount: "12" },
          },
        }),
      );
      const result = await client.getArtistInfo({ artist: "Radiohead", username: "someuser" });
      expect(result).toEqual({ name: "Radiohead", listeners: 100, playCount: 200, userPlayCount: 12 });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(new URL(url).searchParams.get("username")).toBe("someuser");
    });

    it("parses artist.getTopTags, most-used first", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          toptags: {
            tag: [
              { name: "psychedelic", count: 100 },
              { name: "Canadian", count: 24 },
            ],
          },
        }),
      );
      const result = await client.getTopTags({ artist: "Fleece" });
      expect(result).toEqual(["psychedelic", "Canadian"]);
    });

    it("handles artist.getTopTags returning a single bare tag (not an array)", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ toptags: { tag: { name: "solo-genre", count: 1 } } }),
      );
      const result = await client.getTopTags({ artist: "Obscure Artist" });
      expect(result).toEqual(["solo-genre"]);
    });

    it("parses track.getInfo, including real album art", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          track: {
            name: "Under the Light",
            url: "https://www.last.fm/music/Fleece/_/Under+the+Light",
            listeners: "57398",
            playcount: "303244",
            artist: { name: "Fleece" },
            album: {
              title: "Voyager",
              image: [
                { size: "small", "#text": "" },
                { size: "extralarge", "#text": "https://lastfm.example/voyager.png" },
              ],
            },
          },
        }),
      );

      const result = await client.getTrackInfo({ artist: "Fleece", track: "Under the Light" });

      expect(result).toEqual({
        artist: "Fleece",
        track: "Under the Light",
        album: "Voyager",
        imageUrl: "https://lastfm.example/voyager.png",
        listeners: 57398,
        playCount: 303244,
        loved: false,
        url: "https://www.last.fm/music/Fleece/_/Under+the+Light",
      });
    });

    it("includes userPlayCount/loved in track.getInfo when a username is given", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          track: {
            name: "Under the Light",
            url: "https://www.last.fm/music/Fleece/_/Under+the+Light",
            listeners: "57398",
            playcount: "303244",
            userplaycount: "4",
            userloved: "1",
            artist: { name: "Fleece" },
          },
        }),
      );

      const result = await client.getTrackInfo({
        artist: "Fleece",
        track: "Under the Light",
        username: "someuser",
      });

      expect(result).toMatchObject({ userPlayCount: 4, loved: true });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(new URL(url).searchParams.get("username")).toBe("someuser");
    });

    it("track.getInfo omits album/imageUrl when the track has no album", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          track: {
            name: "A Single",
            url: "https://www.last.fm/music/Artist/_/A+Single",
            listeners: "1",
            playcount: "1",
            artist: { name: "Artist" },
          },
        }),
      );

      const result = await client.getTrackInfo({ artist: "Artist", track: "A Single" });

      expect(result.album).toBeUndefined();
      expect(result.imageUrl).toBeUndefined();
    });
  });
});
