import type { NowPlayingApi } from "../../../shared/now-playing-api.js";

declare global {
  interface Window {
    /** Exposed by `src/preload/index.ts` via `contextBridge.exposeInMainWorld`. Only
     * present inside a real Electron renderer with the preload script attached — not
     * in component tests, hence optional rather than asserted non-null. */
    readonly nowPlaying?: NowPlayingApi;
  }
}

export {};
