import { resolveResourcePath, type ResolveResourcePathOptions } from "./resolve-resource-path.js";

/**
 * Resolves `apps/desktop/resources/app-icon.png` — the app's window/Dock/taskbar icon
 * in dev mode (see `create-main-window.ts`'s `icon` option and `main/index.ts`'s
 * `app.dock.setIcon()` call on macOS). Only relevant in dev: a packaged build gets its
 * icon from `electron-builder.yml`'s `mac.icon`/`win.icon`/`linux.icon`
 * (`build/icon.icns`/`.ico`/`.png`) baked into the app bundle itself at package time,
 * not loaded via this path at runtime.
 */
export function resolveAppIconPath(options: ResolveResourcePathOptions): string {
  return resolveResourcePath(options, "app-icon.png");
}
