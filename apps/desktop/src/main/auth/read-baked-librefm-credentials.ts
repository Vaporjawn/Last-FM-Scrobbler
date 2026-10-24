import type { AppCredentials } from "@lastfm-scrobbler/core";

/**
 * Libre.fm counterpart of `lastfm/read-baked-lastfm-credentials.ts` — see that file for
 * why the two `process.env.BAKED_LIBREFM_API_*` reads must stay literal member
 * expressions (they are inlined by `electron.vite.config.ts` at build time).
 */
export function readBakedLibrefmCredentials(): AppCredentials | undefined {
  const apiKey = process.env.BAKED_LIBREFM_API_KEY;
  const apiSecret = process.env.BAKED_LIBREFM_API_SECRET;
  if (!apiKey || !apiSecret) {
    return undefined;
  }
  return { apiKey, apiSecret };
}
