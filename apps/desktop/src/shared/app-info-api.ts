/** Renderer-facing app-metadata API — see `preload/index.ts` for the real
 * implementation and `renderer/src/hooks/use-app-version.ts` for the consuming hook. */
export interface AppInfoApi {
  /** The running app's own version string (`app.getVersion()` — from
   * `apps/desktop/package.json`'s `version` field in dev, or electron-builder's
   * packaged metadata once built). */
  getVersion(): Promise<string>;
}
