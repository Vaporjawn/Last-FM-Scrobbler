/** Thrown by `resolveHelperPath` when no `package.json` is found walking upward from
 * the given start directory — see that function's docstring for when this can happen. */
export class AdapterWindowsPackageRootNotFoundError extends Error {
  /**
   * Builds the error message from the directory the upward search started in.
   *
   * @param startDir The directory the `package.json` search began from.
   */
  constructor(startDir: string) {
    super(
      `Could not locate the @lastfm-scrobbler/adapter-windows package root by walking up ` +
        `from "${startDir}" (expected to find a package.json). If this path looks right, ` +
        `the package layout may have changed.`,
    );
    this.name = "AdapterWindowsPackageRootNotFoundError";
  }
}
