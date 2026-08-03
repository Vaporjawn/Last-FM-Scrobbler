/** Thrown by `MacosPlaybackSource`'s constructor when no `package.json` is found
 * walking upward from the running code's own directory — see `find-package-root.ts`'s
 * docstring for when this can happen. */
export class AdapterMacosPackageRootNotFoundError extends Error {
  constructor(startDir: string) {
    super(
      `Could not locate the @lastfm-scrobbler/adapter-macos package root by walking up ` +
        `from "${startDir}" (expected to find a package.json). If this path looks right, ` +
        `the package layout may have changed.`,
    );
    this.name = "AdapterMacosPackageRootNotFoundError";
  }
}
