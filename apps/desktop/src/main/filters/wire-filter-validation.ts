import electron from "electron";
import { compileFilter, FilterSyntaxError } from "@lastfm-scrobbler/core";
import { IPC_CHANNELS } from "../../shared/ipc-channels.js";
import type { FilterValidationResult } from "../../shared/filter-api.js";

// See main/index.ts for why this is a default import destructured at runtime rather
// than `import { ipcMain } from "electron"`.
const { ipcMain } = electron;

/**
 * Wires the filter-expression validation IPC surface (see `shared/filter-api.ts` for
 * why this exists as its own channel rather than a renderer-side `compileFilter`
 * call). Unconditional, like `wireArtistImage` — no credentials or configuration
 * needed, so this is always available regardless of build.
 */
export function wireFilterValidation(): () => void {
  ipcMain.handle(
    IPC_CHANNELS.filterValidate,
    (_event, expression: unknown): FilterValidationResult => {
      try {
        compileFilter(String(expression));
        return { valid: true };
      } catch (error) {
        const message = error instanceof FilterSyntaxError ? error.message : String(error);
        return { valid: false, error: message };
      }
    },
  );

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.filterValidate);
  };
}
