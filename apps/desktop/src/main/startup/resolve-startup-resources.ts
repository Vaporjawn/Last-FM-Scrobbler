import electron from "electron";
import { resolveAppIconPath } from "../resolve-app-icon-path.js";
import type { StartupResources } from "./startup-resources.js";

const { app } = electron;

/**
 * Resolves the user-data directory, the `resources/` lookup options and the development app
 * icon, and applies that icon to the macOS dock when there is one. Packaged builds get their
 * icon from `electron-builder.yml` instead, so `appIconPath` is `undefined` there.
 */
export function resolveStartupResources(): StartupResources {
  const userDataDir = app.getPath("userData");

  // Shared by every `resources/`-relative lookup below (tray icon, app icon) — see
  // `resolve-resource-path.ts` for why `appPath` and `resourcesPath` aren't
  // interchangeable once packaged.
  const resourcePathOptions = {
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
  };
  // Only meaningful in dev — see `resolve-app-icon-path.ts`'s docstring. A packaged
  // build's icon comes from `electron-builder.yml` instead.
  const appIconPath = app.isPackaged ? undefined : resolveAppIconPath(resourcePathOptions);
  if (appIconPath && process.platform === "darwin") {
    app.dock?.setIcon(appIconPath);
  }
  // Spread into every `showNotification(...)` call below — `exactOptionalPropertyTypes`
  // means `icon: appIconPath` (possibly `undefined`) isn't assignable to `icon?:
  // string`; omitting the key entirely (this spreads to nothing when `appIconPath` is
  // `undefined`) is what that type actually wants. In a packaged build this is always
  // `{}` — `showNotification` falls back to the OS's own default in that case (the
  // app's bundle icon on a real install), same reasoning as `appIconPath` above.
  const notificationIconOption = appIconPath ? { icon: appIconPath } : {};

  return { userDataDir, resourcePathOptions, appIconPath, notificationIconOption };
}
