/**
 * Signing-related environment variables electron-builder reads. GitHub Actions
 * expands a secret that is not configured to an EMPTY STRING rather than leaving the
 * variable unset, and electron-builder treats a defined-but-empty `CSC_LINK` as "a
 * certificate path" (it then fails with "<cwd> not a file" on macOS). Removing the
 * empty ones restores the intended "no credentials, skip signing" behaviour.
 */
export const OPTIONAL_SIGNING_ENV_NAMES = [
  "CSC_LINK",
  "CSC_KEY_PASSWORD",
  "WIN_CSC_LINK",
  "WIN_CSC_KEY_PASSWORD",
  "APPLE_ID",
  "APPLE_APP_SPECIFIC_PASSWORD",
  "APPLE_TEAM_ID",
  "APPLE_API_KEY",
  "APPLE_API_KEY_ID",
  "APPLE_API_ISSUER",
];

/**
 * Returns a copy of `env` without any optional signing variable that is empty or only
 * whitespace. Variables with a real value, and every unrelated variable, are kept.
 *
 * @param {Readonly<Record<string, string | undefined>>} env
 * @returns {Record<string, string | undefined>}
 */
export function resolvePackageEnv(env) {
  const resolved = { ...env };
  for (const name of OPTIONAL_SIGNING_ENV_NAMES) {
    const value = resolved[name];
    if (value !== undefined && value.trim() === "") {
      delete resolved[name];
    }
  }
  return resolved;
}
