/** Thrown by `createWindowsPlaybackSource` when `SmtcHelper.exe` hasn't been compiled
 * yet at the resolved helper path. */
export class SmtcHelperNotBuiltError extends Error {
  constructor(helperPath: string) {
    super(
      `SmtcHelper.exe has not been built yet (expected at "${helperPath}"). Run ` +
        `"pnpm --filter @lastfm-scrobbler/adapter-windows build:native" (Windows + the ` +
        `.NET 8 SDK required) before starting the Windows adapter.`,
    );
    this.name = "SmtcHelperNotBuiltError";
  }
}
