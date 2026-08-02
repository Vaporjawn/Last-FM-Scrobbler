import { join } from "node:path";

export interface ResolveResourcePathOptions {
  /** `app.getAppPath()` — the app root in dev (`apps/desktop`), where `resources/` is
   * a real subdirectory of the source tree. **Not** used when `isPackaged` is true —
   * see `resourcesPath` below. */
  readonly appPath: string;
  /** `process.resourcesPath` — where electron-builder's `extraResources` actually
   * lands in a packaged build (`Contents/Resources/resources/…` on macOS, matching
   * this project's `extraResources: [{from: resources, to: resources}]` in
   * `electron-builder.yml`). **Must** be used instead of `appPath` once packaged:
   * when `asar` is enabled (the default here — see `electron-builder.yml`),
   * `app.getAppPath()` resolves to the `app.asar` archive itself, and `resources/`
   * was never placed *inside* that archive — it's a sibling directory under
   * `Contents/Resources/`, which only `process.resourcesPath` points at directly.
   * Verified against electron-builder's own documented `extraResources` behavior;
   * not independently re-verified against a real packaged launch in this environment
   * (see docs/modules/desktop.md's "Packaging & distribution" verification notes). */
  readonly resourcesPath: string;
  /** `app.isPackaged` — which of the two paths above actually applies. */
  readonly isPackaged: boolean;
}

/**
 * Resolves a path under `apps/desktop/resources/` correctly in both dev and a
 * packaged build — see `ResolveResourcePathOptions` for exactly why `appPath` and
 * `resourcesPath` aren't interchangeable. Shared by `resolveTrayIconPath` and
 * `resolveAppIconPath`, the two current consumers of `resources/`.
 */
export function resolveResourcePath(
  options: ResolveResourcePathOptions,
  ...pathSegments: readonly string[]
): string {
  const base = options.isPackaged ? options.resourcesPath : options.appPath;
  return join(base, "resources", ...pathSegments);
}
