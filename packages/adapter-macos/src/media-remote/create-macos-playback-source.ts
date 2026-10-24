import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { spawn as nodeSpawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  PlaybackSource,
  PlaybackState,
  TrackInfo,
  Unsubscribe,
} from "@lastfm-scrobbler/shared-types";
import { AdapterMacosPackageRootNotFoundError } from "./adapter-macos-package-root-not-found-error.js";
import { findPackageRoot } from "./find-package-root.js";
import { NowPlayingStreamParser } from "./now-playing-stream-parser.js";

const PERL_BIN = "/usr/bin/perl";

/** Options for createMacosPlaybackSource; every field is optional and mainly exists for tests and hosts. */
export interface CreateMacosPlaybackSourceOptions {
  /** Injectable for testing; defaults to `node:child_process`'s `spawn`. */
  readonly spawnImpl?: typeof nodeSpawn;
  /** Called when the mediaremote-adapter process fails to spawn, or exits/crashes
   * after having started — defaults to logging via `console.error`, preserving this
   * adapter's original always-on logging behavior for callers that don't override it. */
  readonly onError?: (error: unknown) => void;
}

/**
 * Implements `PlaybackSource` via MediaRemote — see
 * `packages/adapter-macos/vendor/mediaremote-adapter/VENDORED.md` and
 * `docs/adr/0008-macos-mediaremote-entitlement.md` for why this shells out to a
 * `perl`-hosted helper framework instead of calling the private framework directly.
 *
 * Throws synchronously if `MediaRemoteAdapter.framework` hasn't been built, or this
 * package's own root can't be located — both are static, environment-level
 * preconditions worth failing fast on, independent of whether anyone ever subscribes.
 * Run `node packages/adapter-macos/scripts/build-native.mjs` first (macOS only) if the
 * framework error is what's thrown.
 *
 * The perl/MediaRemote child process itself, however, is spawned lazily on first
 * subscription and torn down once every subscriber has unsubscribed, matching
 * `packages/adapter-linux` and `packages/adapter-windows`'s lifecycle — previously it
 * was spawned unconditionally right here in this function and never torn down, so any
 * caller that constructed a source without ever subscribing (an adapter-availability
 * probe, code that tries multiple adapters and discards the ones it doesn't use) left
 * an orphaned perl process and native framework handle running for the app's entire
 * remaining lifetime with no way to release it.
 */
export function createMacosPlaybackSource(
  options: CreateMacosPlaybackSourceOptions = {},
): PlaybackSource {
  const spawnImpl = options.spawnImpl ?? nodeSpawn;
  const onError =
    options.onError ??
    ((error: unknown) => {
      console.error("adapter-macos: mediaremote-adapter process error:", error);
    });

  // See find-package-root.ts's docstring for why this walks upward for the nearest
  // package.json rather than assuming a fixed number of ".." traversals from
  // import.meta.url — the latter looks right against this file's own location but
  // silently breaks once tsup bundles it into a flat dist/index.js.
  const startDir = dirname(fileURLToPath(import.meta.url));
  const packageRoot = findPackageRoot(startDir);
  if (packageRoot === null) {
    throw new AdapterMacosPackageRootNotFoundError(startDir);
  }

  const perlScriptPath = join(packageRoot, "vendor/mediaremote-adapter/bin/mediaremote-adapter.pl");
  const frameworkPath = join(packageRoot, "native-build/MediaRemoteAdapter.framework");

  if (!existsSync(frameworkPath)) {
    throw new Error(
      `MediaRemoteAdapter.framework not found at ${frameworkPath} — run ` +
        "`node packages/adapter-macos/scripts/build-native.mjs` (macOS + Xcode " +
        "command line tools required) before using createMacosPlaybackSource().",
    );
  }

  const parser = new NowPlayingStreamParser();
  let child: ChildProcessWithoutNullStreams | undefined;
  let subscriberCount = 0;

  /**
   * Spawns the perl mediaremote-adapter helper in "stream" mode if it is not already
   * running, wiring its stdout lines into the parser and its error/exit events into
   * the onError callback. A no-op while a child exists; once an exit has cleared the
   * child, calling it again respawns the helper.
   */
  function ensureStarted(): void {
    if (child) {
      return;
    }

    const spawned = spawnImpl(PERL_BIN, [perlScriptPath, frameworkPath, "stream"]);
    child = spawned;

    spawned.on("error", (error: unknown) => {
      onError(error);
    });
    // Previously unhandled entirely: if the perl process crashed or was killed after
    // successfully starting (OOM, `kill -9`, etc.), the readline pipeline simply
    // stopped emitting lines with zero indication — the parser silently froze on
    // stale state forever. Clearing `child` here (guarded against a stale exit
    // notification for an already-replaced process, same as adapter-windows's
    // equivalent fix) lets a later `ensureStarted()` call actually respawn it.
    spawned.on("exit", (code, signal) => {
      if (child === spawned) {
        child = undefined;
        parser.reset();
      }
      if (code !== 0 && code !== null) {
        onError(
          new Error(`mediaremote-adapter exited with code ${code} (signal: ${signal ?? "none"})`),
        );
      }
    });

    const lines = createInterface({ input: spawned.stdout });
    lines.on("line", (line) => {
      parser.handleLine(line);
    });
  }

  /**
   * Kills the helper process and resets the parser once the last subscriber has
   * unsubscribed, so an unused source holds no child process or native framework handle.
   */
  function stopIfNoSubscribers(): void {
    if (subscriberCount === 0 && child) {
      child.kill();
      child = undefined;
      parser.reset();
    }
  }

  /** Counts a new subscriber and starts the helper for it. If starting throws, the caller
   * never receives an unsubscribe function, so the listener it just registered would stay
   * in the parser forever — it is removed again before rethrowing. */
  function register(unsubscribeFromParser: Unsubscribe): Unsubscribe {
    subscriberCount += 1;
    try {
      ensureStarted();
    } catch (error) {
      unsubscribeFromParser();
      subscriberCount -= 1;
      throw error;
    }
    return () => {
      unsubscribeFromParser();
      subscriberCount -= 1;
      stopIfNoSubscribers();
    };
  }

  return {
    onTrackChanged(callback: (track: TrackInfo) => void): Unsubscribe {
      return register(parser.onTrackChanged(callback));
    },

    onPlaybackStateChanged(callback: (state: PlaybackState) => void): Unsubscribe {
      return register(parser.onPlaybackStateChanged(callback));
    },

    getPosition(): Promise<number> {
      return Promise.resolve(parser.getPosition());
    },
  };
}
