import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { assertTrustedSender } from "../security/assert-trusted-sender.js";

/** The registration surface `createTrustedIpc` returns; handlers added through it are origin-checked. */
export interface TrustedIpc {
  /**
   * Like `ipcMain.handle`, but the handler only runs for a call that comes from this app's
   * own renderer page. Any other caller gets a rejected promise carrying the reason, and
   * the handler is never entered.
   */
  handle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: never[]) => unknown): void;
}

/**
 * A registration facade over `ipcMain` that makes sender validation the default instead of
 * something each handler has to remember. Sender checks used to be written by hand, per
 * handler, in only some modules — so about half of the app's IPC surface (settings
 * writes, the Last.fm data reads, showing the main window, triggering an update check,
 * ...) accepted calls from any frame. Registering through this makes a handler that skips
 * the check impossible to write by accident.
 */
export function createTrustedIpc(
  ipcMain: Pick<IpcMain, "handle">,
  expectedOrigin: string,
): TrustedIpc {
  return {
    handle(channel, handler) {
      // Handlers declare their own argument types; the renderer controls what arrives, so the
      // wrapper treats it as unknown and each handler validates its own arguments.
      const untypedHandler = handler as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;
      ipcMain.handle(channel, (event, ...args: unknown[]) => {
        assertTrustedSender(event, expectedOrigin);
        return untypedHandler(event, ...args);
      });
    },
  };
}
