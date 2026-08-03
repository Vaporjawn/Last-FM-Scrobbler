import type { JSX } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  /** Defaults to "Confirm" — pass something more specific to the action (e.g. "Reset
   * to defaults") so the confirm button never reads as a generic, context-free "OK". */
  readonly confirmLabel?: string;
  /** Shows a busy confirm button and disables both actions while `true` — for actions
   * that go through an async IPC round-trip rather than resolving instantly. */
  readonly confirming?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * A generic "are you sure?" modal for destructive or hard-to-reverse actions — first
 * user: `SettingsPage`'s "Reset to defaults". Deliberately generic (no knowledge of
 * what it's confirming) so it's reusable for any future confirm-before-destructive-
 * action need rather than each caller building its own one-off `Dialog`.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  confirming,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={confirming}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={onConfirm} disabled={confirming}>
          {confirming ? "Working…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
