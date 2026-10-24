import type { AppCredentials } from "@lastfm-scrobbler/core";

/**
 * Reads the Last.fm API key/secret that was baked into this build, if any.
 *
 * The two `process.env.BAKED_LASTFM_API_*` reads below are deliberately written as
 * literal member expressions: `electron.vite.config.ts` inlines them at
 * `electron-vite build` time (from the CI job's `LASTFM_API_KEY` /
 * `LASTFM_API_SECRET`), which is the only way a value reaches a packaged binary — a
 * CI environment variable on its own does not exist on an end user's machine. A
 * `define` only matches this exact source text, so these must not be aliased through a
 * local `env` variable. In dev and in tests nothing is inlined, so they are ordinary
 * runtime lookups that come back `undefined`.
 */
export function readBakedLastfmCredentials(): AppCredentials | undefined {
  const apiKey = process.env.BAKED_LASTFM_API_KEY;
  const apiSecret = process.env.BAKED_LASTFM_API_SECRET;
  if (!apiKey || !apiSecret) {
    return undefined;
  }
  return { apiKey, apiSecret };
}
