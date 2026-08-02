import electron from "electron";
import type { BrowserWindow } from "electron";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { dialog } from "electron"`.
const { dialog } = electron;

/**
 * Shows a native "update ready" dialog once a version has finished downloading.
 * Resolves `true` if the user chose to restart immediately, `false` if they chose to
 * keep working (the update still applies automatically next time they quit and
 * reopen the app, since `autoUpdater.autoInstallOnAppQuit` isn't the mechanism here —
 * see `create-updater-client.ts` — the *downloaded* installer just sits there until
 * either this dialog's "Restart Now" or a normal quit triggers Squirrel/NSIS's own
 * apply-on-next-launch behavior).
 *
 * A native dialog rather than in-app UI on purpose: this is a background/tray app
 * whose window is very often hidden (see docs/modules/desktop.md's "Background app"
 * section) — a banner inside a hidden window would never be seen.
 */
export async function showRestartPrompt(
  mainWindow: BrowserWindow,
  version: string,
): Promise<boolean> {
  const result = await dialog.showMessageBox(mainWindow, {
    type: "info",
    buttons: ["Restart Now", "Later"],
    defaultId: 0,
    cancelId: 1,
    title: "Update ready",
    message: `Last.fm Scrobbler ${version} has been downloaded.`,
    detail:
      "Restart now to finish installing it, or keep working — it'll finish " +
      "installing the next time you quit and reopen the app.",
  });
  return result.response === 0;
}
