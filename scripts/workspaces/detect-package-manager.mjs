/**
 * Detects which package manager launched this process from `npm_config_user_agent`, so the
 * same manager is used to run each workspace script. Defaults to npm when the script was not
 * started through a package manager's `run` wrapper, since npm ships with Node.
 *
 * @returns {"npm" | "pnpm" | "bun" | "yarn"} The package manager name.
 */
export function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent;
  if (userAgent) {
    const name = userAgent.split("/")[0];
    if (name === "npm" || name === "pnpm" || name === "bun" || name === "yarn") {
      return name;
    }
  }
  // Not invoked through a package manager's `run` wrapper (e.g. called directly via
  // `node scripts/run-workspaces.mjs`) — default to npm, since it ships with Node.
  return "npm";
}
