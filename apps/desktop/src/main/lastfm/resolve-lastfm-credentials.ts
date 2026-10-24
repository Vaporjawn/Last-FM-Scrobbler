import type { AppCredentials, AppCredentialsStore } from "@lastfm-scrobbler/core";
import { readBakedLastfmCredentials } from "./read-baked-lastfm-credentials.js";

/** Inputs to `resolveLastfmCredentials`; every field is injectable so tests control the sources. */
export interface ResolveLastfmCredentialsOptions {
  /** Injectable for testing; defaults to `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Injectable for testing; defaults to the pair `electron.vite.config.ts` inlined at
   * build time (see `read-baked-lastfm-credentials.ts`). */
  readonly baked?: AppCredentials | undefined;
  readonly appCredentialsStore?: AppCredentialsStore | undefined;
}

/** A Last.fm API key/secret pair together with the place it was resolved from. */
export interface ResolvedLastfmCredentials extends AppCredentials {
  /** Where these credentials came from — lets the UI explain why login is (or isn't)
   * available, and whether the active key is one the end user can change/clear
   * themselves versus one baked into this build. */
  readonly source: "environment" | "user-supplied";
}

/**
 * Resolves the Last.fm API key/secret this app run should use. `LASTFM_API_KEY` /
 * `LASTFM_API_SECRET` environment variables take precedence when both are set — an
 * explicit choice by whoever launched this instance — then the pair baked into this
 * build at package time, then a key the end user saved themselves via Settings → Accounts (see `AppCredentialsStore`,
 * `main/auth/wire-auth.ts`). Returns `undefined` if neither source has a usable pair,
 * same as `create-lastfm-client.ts`'s env-only `createLastfmClient` did before this
 * existed.
 */
export async function resolveLastfmCredentials(
  options: ResolveLastfmCredentialsOptions = {},
): Promise<ResolvedLastfmCredentials | undefined> {
  const env = options.env ?? process.env;
  if (env.LASTFM_API_KEY && env.LASTFM_API_SECRET) {
    return {
      apiKey: env.LASTFM_API_KEY,
      apiSecret: env.LASTFM_API_SECRET,
      source: "environment",
    };
  }

  const baked = "baked" in options ? options.baked : readBakedLastfmCredentials();
  if (baked) {
    return { ...baked, source: "environment" };
  }

  const stored = await options.appCredentialsStore?.get();
  if (stored) {
    return { ...stored, source: "user-supplied" };
  }

  return undefined;
}
