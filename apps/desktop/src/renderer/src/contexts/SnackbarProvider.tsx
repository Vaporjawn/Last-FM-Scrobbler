import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { SnackbarContext, type NotifyOptions } from "./snackbar-context.js";

interface QueuedSnackbar extends NotifyOptions {
  readonly key: number;
}

const DEFAULT_DURATION_MS = 4000;
/** Errors stay up longer by default — they're more important to actually read than a
 * routine success confirmation. */
const ERROR_DURATION_MS = 8000;

export interface SnackbarProviderProps {
  readonly children: ReactNode;
}

/**
 * App-wide transient-message system — mounted once in `App.tsx`, inside `ThemeProvider`
 * so the rendered `Snackbar`/`Alert` picks up the app theme. Any descendant calls
 * `useSnackbar().notify(...)` (see `snackbar-context.ts`) to queue a message; this
 * component owns the actual queue and renders exactly one `Snackbar` at a time,
 * following MUI's own documented pattern for consecutive snackbars: a new message
 * queues behind the current one rather than replacing or stacking on top of it.
 */
export function SnackbarProvider({ children }: SnackbarProviderProps): JSX.Element {
  const [queue, setQueue] = useState<QueuedSnackbar[]>([]);
  const [current, setCurrent] = useState<QueuedSnackbar | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const nextKey = useRef(0);

  const notify = useCallback((options: NotifyOptions) => {
    nextKey.current += 1;
    setQueue((previous) => [...previous, { ...options, key: nextKey.current }]);
  }, []);

  useEffect(() => {
    if (queue.length === 0) {
      return;
    }
    if (!current) {
      // Nothing showing — bring the next queued message up immediately.
      setCurrent(queue[0]);
      setQueue((previous) => previous.slice(1));
      setOpen(true);
    } else if (open) {
      // Something is already showing and more is queued behind it — close the current
      // one now; `handleExited` below picks up the next item once its exit transition
      // finishes, so two messages never visually overlap.
      setOpen(false);
    }
  }, [queue, current, open]);

  const handleClose = useCallback((_event: unknown, reason?: string) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  }, []);

  const handleExited = useCallback(() => {
    setCurrent(undefined);
  }, []);

  const duration =
    current?.autoHideDurationMs ??
    (current?.severity === "error" ? ERROR_DURATION_MS : DEFAULT_DURATION_MS);

  return (
    <SnackbarContext.Provider value={{ notify }}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{ transition: { onExited: handleExited } }}
      >
        {current ? (
          <Alert
            onClose={handleClose}
            severity={current.severity ?? "info"}
            variant="filled"
            sx={{ width: "100%" }}
            action={
              current.action ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    current.action?.onClick();
                    setOpen(false);
                  }}
                >
                  {current.action.label}
                </Button>
              ) : undefined
            }
          >
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </SnackbarContext.Provider>
  );
}
