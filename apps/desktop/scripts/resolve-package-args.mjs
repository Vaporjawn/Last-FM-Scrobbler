/**
 * Builds the argument list handed to `electron-builder`.
 *
 * The `package*` npm scripts bake in `--publish never` so a local `npm run package`
 * can never upload anything, and `.github/workflows/release.yml` appends its own
 * `--publish always` on a real `v*` tag push. Passed through verbatim that is two
 * `--publish` flags, which electron-builder's parser turns into an array, so a release
 * either errors or silently keeps the safe-but-useless `never`. This keeps only the
 * LAST `--publish` (and its value) so the explicit caller always wins.
 *
 * @param {readonly string[]} args raw arguments after `package.mjs`
 * @returns {string[]} the same arguments with all but the last `--publish <value>` removed
 */
export function resolvePackageArgs(args) {
  let lastPublishIndex = -1;
  args.forEach((arg, index) => {
    if (arg === "--publish") {
      lastPublishIndex = index;
    }
  });

  const resolved = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--publish" && index !== lastPublishIndex) {
      index += 1; // drop its value too
      continue;
    }
    resolved.push(arg);
  }
  return resolved;
}
