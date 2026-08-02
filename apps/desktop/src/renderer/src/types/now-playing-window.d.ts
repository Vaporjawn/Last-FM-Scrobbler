import type { AuthApi } from "../../../shared/auth-api.js";
import type { BugReportApi } from "../../../shared/bug-report-api.js";
import type { LastfmDataApi } from "../../../shared/lastfm-api.js";
import type { NowPlayingApi } from "../../../shared/now-playing-api.js";

declare global {
  interface Window {
    /** Exposed by `src/preload/index.ts` via `contextBridge.exposeInMainWorld`. Only
     * present inside a real Electron renderer with the preload script attached — not
     * in component tests, hence optional rather than asserted non-null. */
    readonly nowPlaying?: NowPlayingApi;
    readonly auth?: AuthApi;
    readonly lastfm?: LastfmDataApi;
    readonly bugReport?: BugReportApi;
  }
}

export {};
