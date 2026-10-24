import type { ResolveResourcePathOptions } from "../resolve-resource-path.js";

/** Filesystem locations and icon settings resolved once at startup and shared by later steps. */
export interface StartupResources {
  /** `app.getPath("userData")`: where settings, secrets and the scrobble queue live. */
  readonly userDataDir: string;
  /** Shared by every `resources/`-relative lookup (tray icon, app icon). */
  readonly resourcePathOptions: ResolveResourcePathOptions;
  /** The development-only app icon path; `undefined` in a packaged build. */
  readonly appIconPath: string | undefined;
  /** Spread into every `showNotification(...)` call; `{}` when there is no icon path. */
  readonly notificationIconOption: { readonly icon?: string };
}
