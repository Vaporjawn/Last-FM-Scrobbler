import type { PlaybackSource } from "@lastfm-scrobbler/shared-types";
import { createMacosPlaybackSource } from "@lastfm-scrobbler/adapter-macos";
import { createLinuxPlaybackSource } from "@lastfm-scrobbler/adapter-linux";
import { createWindowsPlaybackSource } from "@lastfm-scrobbler/adapter-windows";

/**
 * Picks the `PlaybackSource` for the current OS and constructs it, catching and
 * logging construction failures instead of crashing app startup — a missing native
 * build (macOS/Windows — see docs/modules/adapter-{macos,windows}.md) means "no live
 * now-playing tracking this run", not "the app won't launch".
 */
export function createPlatformPlaybackSource(
  onError: (message: string) => void = console.error,
): PlaybackSource | undefined {
  try {
    switch (process.platform) {
      case "darwin":
        return createMacosPlaybackSource();
      case "linux":
        return createLinuxPlaybackSource();
      case "win32":
        return createWindowsPlaybackSource();
      default:
        onError(`No playback source adapter for platform "${process.platform}".`);
        return undefined;
    }
  } catch (error) {
    onError(`Failed to create a playback source for this platform: ${String(error)}`);
    return undefined;
  }
}
