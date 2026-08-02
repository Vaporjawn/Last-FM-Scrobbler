import { useEffect, useState, type JSX } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useBugReport } from "../hooks/use-bug-report.js";

export interface BugReportDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * Files a report anonymously as a GitHub issue via `services/bug-report-relay` — no
 * GitHub account needed. See docs/adr/0004-anonymous-bug-report-relay.md.
 */
export function BugReportDialog({ open, onClose }: BugReportDialogProps): JSX.Element | null {
  const { isConfigured, submitting, error, issueUrl, submit, reset } = useBugReport();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) {
      reset();
      setTitle("");
      setBody("");
    }
  }, [open, reset]);

  if (!open) {
    return null;
  }

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !submitting;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Report a Bug</DialogTitle>
      <DialogContent>
        {isConfigured === undefined ? (
          <CircularProgress size={24} />
        ) : !isConfigured ? (
          <Alert severity="warning">
            Bug reporting is not configured for this build. See docs/modules/desktop.md.
          </Alert>
        ) : issueUrl ? (
          <Stack spacing={1.5}>
            <Alert severity="success">Thanks — your report was filed.</Alert>
            <Typography>
              <Link href={issueUrl} target="_blank" rel="noreferrer">
                {issueUrl}
              </Link>
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label="Title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              fullWidth
              autoFocus
            />
            <TextField
              label="Description"
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
              }}
              fullWidth
              multiline
              minRows={4}
              helperText="What happened? What did you expect instead? Steps to reproduce, if known."
            />
            <Typography variant="caption" color="text.secondary">
              This report is filed anonymously as a public GitHub issue — no account
              needed, and none of your Last.fm credentials are included.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{issueUrl ? "Close" : "Cancel"}</Button>
        {isConfigured && !issueUrl ? (
          <Button
            variant="contained"
            disabled={!canSubmit}
            onClick={() => void submit(title.trim(), body.trim())}
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
