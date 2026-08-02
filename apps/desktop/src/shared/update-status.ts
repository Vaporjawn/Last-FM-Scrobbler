/**
 * Current state of the auto-updater (see `main/updates/wire-updates.ts`), pushed to
 * the renderer over `IPC_CHANNELS.updatesStatusChanged` and pullable via
 * `IPC_CHANNELS.updatesGetStatus` for a renderer mounting after the fact — same
 * push-plus-pull shape as `NowPlayingSnapshot`/`nowPlayingGetCurrent`.
 */
export type UpdateStatus =
  | { readonly phase: "idle" }
  | { readonly phase: "checking" }
  | { readonly phase: "available"; readonly version: string }
  | { readonly phase: "not-available" }
  | { readonly phase: "downloading"; readonly percent: number }
  | { readonly phase: "downloaded"; readonly version: string }
  | { readonly phase: "error"; readonly message: string };
