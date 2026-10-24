import type { UpdateStatus } from "../../../shared/update-status.js";

/** Human-readable summary of `UpdateStatus` for the Settings "Updates" row —
 * `undefined` for "idle" (nothing worth saying before the first check has even run). */
export function describeUpdateStatus(status: UpdateStatus): string | undefined {
  switch (status.phase) {
    case "idle":
      return undefined;
    case "checking":
      return "Checking for updates…";
    case "available":
      return `Update ${status.version} found — downloading…`;
    case "not-available":
      return "You're up to date.";
    case "downloading":
      return `Downloading update… ${Math.round(status.percent)}%`;
    case "downloaded":
      return `Update ${status.version} downloaded — restart to install it.`;
    case "error":
      return `Couldn't check for updates: ${status.message}`;
  }
}
