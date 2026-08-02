import { createContext, useContext } from "react";

export type SnackbarSeverity = "success" | "error" | "info" | "warning";

export interface SnackbarAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface NotifyOptions {
  readonly message: string;
  /** Default `"info"`. */
  readonly severity?: SnackbarSeverity;
  /** An optional single action button rendered inside the snackbar (e.g. "Restart now"). */
  readonly action?: SnackbarAction;
  /** How long the snackbar stays up before auto-dismissing, in milliseconds. Default
   * scales with severity in `SnackbarProvider` (errors stay up longer) unless set here. */
  readonly autoHideDurationMs?: number;
}

export interface SnackbarContextValue {
  /** Queues a transient message — see `SnackbarProvider` for the actual queuing/display
   * behavior (one at a time, first in first out). */
  readonly notify: (options: NotifyOptions) => void;
}

export const SnackbarContext = createContext<SnackbarContextValue | undefined>(undefined);

const NOOP_SNACKBAR: SnackbarContextValue = { notify: () => undefined };

/**
 * Reads the app-wide snackbar context (see `SnackbarProvider`, mounted once in
 * `App.tsx`). Returns a no-op `notify` — never throws — when no `SnackbarProvider` is
 * an ancestor, which is expected in component tests that render a single page in
 * isolation (matching this codebase's established `useAuth`/`useSettings`/etc.
 * "degrade gracefully when the surrounding context isn't present" convention, rather
 * than requiring every existing test to wrap its subject in a new provider).
 */
export function useSnackbar(): SnackbarContextValue {
  return useContext(SnackbarContext) ?? NOOP_SNACKBAR;
}
