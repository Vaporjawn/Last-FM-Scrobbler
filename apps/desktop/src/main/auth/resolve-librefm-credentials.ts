import type { AppCredentials, AppCredentialsStore } from "@lastfm-scrobbler/core";
import { readBakedLibrefmCredentials } from "./read-baked-librefm-credentials.js";

export interface ResolveLibrefmCredentialsOptions {
  /** Injectable for testing; defaults to `process.env`. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Injectable for testing; defaults to the pair `electron.vite.config.ts` inlined at
   * build time (see `read-baked-librefm-credentials.ts`). */
  readonly baked?: AppCredentials | undefined;
  readonly librefmAppCredentialsStore?: AppCredentialsStore | undefined;
}

export interface ResolvedLibrefmCredentials extends AppCredentials {
  /** Where these credentials came from — same reasoning and same shape as
   * `resolve-lastfm-credentials.ts`'s `ResolvedLastfmCredentials.source`, just for
   * Libre.fm's own key/secret pair. */
  readonly source: "environment" | "user-supplied";
}

/**
 * Resolves the Libre.fm API key/secret this app run should use — `LIBREFM_API_KEY` /
 * `LIBREFM_API_SECRET` environment variables take precedence when both are set,
 * then the pair baked into this build, then a key the end user saved themselves via
 * Settings → Accounts. Exact
 * mirror of `resolve-lastfm-credentials.ts`'s `resolveLastfmCredentials`, just for
 * Libre.fm — see that function's docstring for the full reasoning, which applies here
 * unchanged. Kept as a separate function/file (not a shared, service-parameterized
 * one) since the two already-existing call sites for the Last.fm version predate
 * multi-service support and there's no benefit to coupling them just to save one
 * small function.
 */
export async function resolveLibrefmCredentials(
  options: ResolveLibrefmCredentialsOptions = {},
): Promise<ResolvedLibrefmCredentials | undefined> {
  const env = options.env ?? process.env;
  if (env.LIBREFM_API_KEY && env.LIBREFM_API_SECRET) {
    return {
      apiKey: env.LIBREFM_API_KEY,
      apiSecret: env.LIBREFM_API_SECRET,
      source: "environment",
    };
  }

  const baked = "baked" in options ? options.baked : readBakedLibrefmCredentials();
  if (baked) {
    return { ...baked, source: "environment" };
  }

  const stored = await options.librefmAppCredentialsStore?.get();
  if (stored) {
    return { ...stored, source: "user-supplied" };
  }

  return undefined;
}
