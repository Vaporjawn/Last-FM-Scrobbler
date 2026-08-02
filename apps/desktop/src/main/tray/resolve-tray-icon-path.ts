import { resolveResourcePath, type ResolveResourcePathOptions } from "../resolve-resource-path.js";

/**
 * Resolves the tray icon file for a platform — see `apps/desktop/resources/`. macOS
 * gets the template variant (solid black + alpha) so the menu bar can recolor it for
 * light/dark mode and Retina displays automatically (`tray-iconTemplate@2x.png` is
 * picked up by Electron's `nativeImage` on its own via the `@2x` filename convention,
 * no extra code needed); other platforms get the colored version.
 */
export function resolveTrayIconPath(
  options: ResolveResourcePathOptions,
  platform: NodeJS.Platform = process.platform,
): string {
  const filename = platform === "darwin" ? "tray-iconTemplate.png" : "tray-icon.png";
  return resolveResourcePath(options, filename);
}
