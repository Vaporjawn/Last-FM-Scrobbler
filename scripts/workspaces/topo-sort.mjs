/**
 * Topologically sorts packages so that any workspace package a given package depends on
 * (via a "@lastfm-scrobbler/*" dependency) runs before it. Falls back to declared order for
 * packages with no inter-workspace dependencies.
 *
 * @param {{ name: string, pkg: any }[]} packages The packages from `loadPackages`.
 * @returns {{ name: string, pkg: any }[]} The packages in dependency order.
 */
export function topoSort(packages) {
  const byName = new Map(packages.map((p) => [p.name, p]));
  const visited = new Set();
  const sorted = [];

  /**
   * Depth-first visit: recurses into each workspace dependency (runtime or dev) before
   * appending the package itself, so dependencies land earlier in `sorted`. The `visited`
   * set is marked before recursing, which also keeps a dependency cycle from looping.
   */
  function visit(pkg) {
    if (visited.has(pkg.name)) return;
    visited.add(pkg.name);
    const deps = { ...pkg.pkg.dependencies, ...pkg.pkg.devDependencies };
    for (const depName of Object.keys(deps)) {
      const depPkg = byName.get(depName);
      if (depPkg) visit(depPkg);
    }
    sorted.push(pkg);
  }

  for (const pkg of packages) visit(pkg);
  return sorted;
}
