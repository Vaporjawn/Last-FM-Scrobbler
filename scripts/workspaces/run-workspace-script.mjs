import { spawnSync } from "node:child_process";
import { detectPackageManager } from "./detect-package-manager.mjs";
import { loadPackages } from "./load-packages.mjs";
import { topoSort } from "./topo-sort.mjs";

/**
 * Runs one package.json script across every workspace package, in dependency order, using
 * whichever package manager launched this process. Packages that do not define the script are
 * skipped (`--if-present` semantics) unless `--package` names one specifically. Exits the
 * process with a usage message on bad arguments, and with the failing script's status at the
 * first failure.
 *
 * @param {string[]} args The command-line arguments: `<script> [--package <name>]`.
 * @returns {void}
 */
export function runWorkspaceScript(args) {
  const scriptName = args[0];
  if (!scriptName) {
    console.error("Usage: node scripts/run-workspaces.mjs <script> [--package <name>]");
    process.exit(1);
  }

  const packageFlagIndex = args.indexOf("--package");
  const onlyPackage = packageFlagIndex !== -1 ? args[packageFlagIndex + 1] : undefined;

  const pm = detectPackageManager();
  const allPackages = topoSort(loadPackages());
  const targets = onlyPackage ? allPackages.filter((p) => p.name === onlyPackage) : allPackages;

  if (onlyPackage && targets.length === 0) {
    console.error(`No workspace package named "${onlyPackage}" found.`);
    process.exit(1);
  }

  for (const { dir, name, pkg } of targets) {
    const hasScript = Boolean(pkg.scripts?.[scriptName]);
    if (!hasScript) {
      if (onlyPackage) {
        console.error(`Package "${name}" has no "${scriptName}" script.`);
        process.exit(1);
      }
      continue; // --if-present semantics: silently skip
    }

    console.log(`\n> ${name} ${scriptName} (via ${pm})`);
    const result = spawnSync(pm, ["run", scriptName], {
      cwd: dir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    if (result.status !== 0) {
      console.error(`\n"${scriptName}" failed in ${name}`);
      process.exit(result.status ?? 1);
    }
  }
}
