// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS } from "../../src/shared/ipc-channels.js";

const electronMock = vi.hoisted(() => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
}));

vi.mock("electron", () => ({ default: electronMock }));

type Api = Record<string, (...args: unknown[]) => unknown>;
type ChannelName = keyof typeof IPC_CHANNELS;

/** Loads the preload script fresh and returns everything it exposed to the renderer. */
async function loadPreload(): Promise<Record<string, unknown>> {
  vi.resetModules();
  electronMock.contextBridge.exposeInMainWorld.mockClear();
  await import("../../src/preload/index.js");
  return Object.fromEntries(
    electronMock.contextBridge.exposeInMainWorld.mock.calls as [string, unknown][],
  );
}

beforeEach(() => {
  electronMock.ipcRenderer.invoke.mockReset();
  electronMock.ipcRenderer.on.mockReset();
  electronMock.ipcRenderer.removeListener.mockReset();
});

/** [exposed global, method, channel it must invoke, arguments to pass through] */
const INVOKE_CASES: readonly [string, string, ChannelName, readonly unknown[]][] = [
  ["nowPlaying", "getCurrent", "nowPlayingGetCurrent", []],
  ["auth", "isConfigured", "authIsConfigured", []],
  ["auth", "credentialsSource", "authCredentialsSource", []],
  ["auth", "login", "authLogin", []],
  ["auth", "logout", "authLogout", ["victor"]],
  ["auth", "listAccounts", "authListAccounts", []],
  ["auth", "getActiveAccount", "authGetActiveAccount", []],
  ["auth", "setActiveAccount", "authSetActiveAccount", ["victor"]],
  ["auth", "setAppCredentials", "authSetAppCredentials", ["key", "secret"]],
  ["auth", "clearAppCredentials", "authClearAppCredentials", []],
  ["auth", "relaunch", "appRelaunch", []],
  ["librefm", "isConfigured", "librefmIsConfigured", []],
  ["librefm", "credentialsSource", "librefmCredentialsSource", []],
  ["librefm", "setCredentials", "librefmSetCredentials", ["key", "secret"]],
  ["librefm", "clearCredentials", "librefmClearCredentials", []],
  ["librefm", "login", "librefmLogin", []],
  ["librefm", "logout", "librefmLogout", []],
  ["librefm", "getActiveAccount", "librefmGetActiveAccount", []],
  ["listenbrainz", "connect", "listenbrainzConnect", ["token"]],
  ["listenbrainz", "disconnect", "listenbrainzDisconnect", []],
  ["listenbrainz", "getActiveAccount", "listenbrainzGetActiveAccount", []],
  ["lastfm", "getRecentTracks", "lastfmGetRecentTracks", ["u", 10, 2]],
  ["lastfm", "getTopArtists", "lastfmGetTopArtists", ["u", 10, "7day"]],
  ["lastfm", "getTopTracks", "lastfmGetTopTracks", ["u", 10, "7day"]],
  ["lastfm", "getTopAlbums", "lastfmGetTopAlbums", ["u", 10, "7day"]],
  ["lastfm", "getFriends", "lastfmGetFriends", ["u"]],
  ["lastfm", "getUserInfo", "lastfmGetUserInfo", ["u"]],
  ["lastfm", "getLovedTracksCount", "lastfmGetLovedTracksCount", ["u"]],
  ["lastfm", "getArtistInfo", "lastfmGetArtistInfo", ["Radiohead", "u"]],
  ["lastfm", "getSimilarArtists", "lastfmGetSimilarArtists", ["Radiohead", 5]],
  ["lastfm", "getTopTags", "lastfmGetTopTags", ["Radiohead"]],
  ["lastfm", "getTrackInfo", "lastfmGetTrackInfo", ["Radiohead", "Nude", "u"]],
  ["lastfm", "loveTrack", "lastfmLoveTrack", ["Radiohead", "Nude"]],
  ["lastfm", "unloveTrack", "lastfmUnloveTrack", ["Radiohead", "Nude"]],
  ["lastfm", "addTags", "lastfmAddTags", ["Radiohead", "Nude", ["a", "b"]]],
  ["artistImage", "getUrl", "artistImageGetUrl", ["Radiohead"]],
  ["filter", "validate", "filterValidate", ["artist == 'x'"]],
  ["bugReport", "isConfigured", "bugReportIsConfigured", []],
  ["bugReport", "submit", "bugReportSubmit", ["title", "body"]],
  ["settings", "get", "settingsGet", []],
  ["settings", "set", "settingsSet", [{ themeMode: "dark" }]],
  ["settings", "reset", "settingsReset", []],
  ["updates", "getStatus", "updatesGetStatus", []],
  ["updates", "checkNow", "updatesCheckNow", []],
  ["networkStatus", "getStatus", "networkStatusGetStatus", []],
  ["appInfo", "getVersion", "appGetVersion", []],
  ["appInfo", "showMainWindow", "appShowMainWindow", []],
];

/** [exposed global, subscribe method, channel the listener must be attached to] */
const SUBSCRIPTION_CASES: readonly [string, string, ChannelName][] = [
  ["nowPlaying", "onTrackChanged", "nowPlayingTrackChanged"],
  ["nowPlaying", "onPlaybackStateChanged", "nowPlayingStateChanged"],
  ["nowPlaying", "onPositionChanged", "nowPlayingPositionChanged"],
  ["updates", "onStatusChanged", "updatesStatusChanged"],
  ["networkStatus", "onStatusChanged", "networkStatusChanged"],
];

describe("preload bridge", () => {
  it("exposes every API plus the platform and initial theme to the renderer", async () => {
    const exposed = await loadPreload();

    expect(Object.keys(exposed).sort()).toEqual(
      [
        "appInfo",
        "artistImage",
        "auth",
        "bugReport",
        "filter",
        "initialThemeMode",
        "lastfm",
        "librefm",
        "listenbrainz",
        "networkStatus",
        "nowPlaying",
        "platform",
        "settings",
        "updates",
      ].sort(),
    );
    expect(exposed.platform).toBe(process.platform);
  });

  it.each(INVOKE_CASES)(
    "%s.%s invokes the %s channel with its arguments",
    async (api, method, channel, args) => {
      const exposed = (await loadPreload())[api] as Api;
      electronMock.ipcRenderer.invoke.mockResolvedValue("result");

      const result = await exposed[method]?.(...args);

      expect(electronMock.ipcRenderer.invoke).toHaveBeenCalledWith(IPC_CHANNELS[channel], ...args);
      expect(result).toBe("result");
    },
  );

  it.each(SUBSCRIPTION_CASES)(
    "%s.%s forwards payloads to the callback and unsubscribes the same listener",
    async (api, method, channel) => {
      const exposed = (await loadPreload())[api] as Api;
      const callback = vi.fn();

      const unsubscribe = exposed[method]?.(callback) as () => void;

      expect(electronMock.ipcRenderer.on).toHaveBeenCalledWith(
        IPC_CHANNELS[channel],
        expect.any(Function),
      );
      const listener = electronMock.ipcRenderer.on.mock.calls[0]?.[1] as (
        event: unknown,
        payload: unknown,
      ) => void;
      listener({ sender: "ignored" }, { payload: 1 });
      expect(callback).toHaveBeenCalledWith({ payload: 1 });

      unsubscribe();
      expect(electronMock.ipcRenderer.removeListener).toHaveBeenCalledWith(
        IPC_CHANNELS[channel],
        listener,
      );
    },
  );
});
