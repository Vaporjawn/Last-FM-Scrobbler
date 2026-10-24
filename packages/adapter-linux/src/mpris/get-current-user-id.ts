/** The subset of `process` this needs; narrowed so both outcomes are testable on any OS. */
export interface UserIdSource {
  readonly getuid?: () => number;
}

/**
 * The current user's id, or `undefined` where the platform has none (`process.getuid` does
 * not exist on Windows). Taking the source as a parameter, rather than reading `process`
 * inline, keeps both outcomes covered by tests on every OS instead of only the one a CI
 * runner happens to be.
 */
export function getCurrentUserId(source: UserIdSource = process): number | undefined {
  return source.getuid?.();
}
