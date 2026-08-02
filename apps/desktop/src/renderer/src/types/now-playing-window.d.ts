import type { AppInfoApi } from "../../../shared/app-info-api.js";
import type { ArtistImageApi } from "../../../shared/artist-image-api.js";
import type { AuthApi } from "../../../shared/auth-api.js";
import type { BugReportApi } from "../../../shared/bug-report-api.js";
import type { LastfmDataApi } from "../../../shared/lastfm-api.js";
import type { NowPlayingApi } from "../../../shared/now-playing-api.js";
import type { SettingsApi } from "../../../shared/settings-api.js";
import type { UpdatesApi } from "../../../shared/updates-api.js";

declare global {
  interface Window {
    /** Exposed by `src/preload/index.ts` via `contextBridge.exposeInMainWorld`. Only
     * present inside a real Electron renderer with the preload script attached — not
     * in component tests, hence optional rather than asserted non-null. */
    readonly nowPlaying?: NowPlayingApi;
    readonly auth?: AuthApi;
    readonly lastfm?: LastfmDataApi;
    readonly artistImage?: ArtistImageApi;
    readonly bugReport?: BugReportApi;
    readonly settings?: SettingsApi;
    readonly updates?: UpdatesApi;
    readonly appInfo?: AppInfoApi;
    /** `process.platform`, exposed as a plain value — see `preload/index.ts`. Optional
     * for the same reason as the APIs above (absent outside a real Electron renderer). */
    readonly platform?: NodeJS.Platform;
  }
}

export {};
