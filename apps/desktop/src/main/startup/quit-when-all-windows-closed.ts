import electron from "electron";

const { app } = electron;

/**
 * Quits the app when the last window closes, except on macOS where apps conventionally stay
 * running. With closeToTray enabled (the default), closing the window is intercepted before it
 * ever gets here (see `wireCloseToTray`); this only fires when the user has disabled that
 * setting and actually closed the window.
 */
export function quitWhenAllWindowsClosed(): void {
  if (process.platform !== "darwin") {
    app.quit();
  }
}
