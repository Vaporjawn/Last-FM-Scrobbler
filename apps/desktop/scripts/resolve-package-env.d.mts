export const OPTIONAL_SIGNING_ENV_NAMES: readonly string[];
export function resolvePackageEnv(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined>;
