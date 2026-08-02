import type { JSX, ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

interface AsyncStateLoadingProps {
  readonly kind: "loading";
  /** Visually-hidden-ish text for screen readers — `CircularProgress` alone has no
   * label of its own. Defaults to "Loading…"; pass something more specific ("Loading
   * scrobbles…") where it helps. */
  readonly label?: string;
}

interface AsyncStateEmptyProps {
  readonly kind: "empty";
  /** A sized icon element, e.g. `<LibraryMusicIcon sx={{ fontSize: 48 }} />` — pass
   * one per call site (a bare, unsized icon renders at MUI's small 24px default,
   * which reads as an afterthought rather than a deliberate empty state). Rendered in
   * a muted color; the icon inherits it via `currentColor` unless it sets its own. */
  readonly icon: ReactNode;
  readonly message: string;
}

interface AsyncStateErrorProps {
  readonly kind: "error";
  readonly message: string;
  /** Only pass this where the page actually has a way to re-fetch. As of this
   * component's introduction, none of this app's data-fetching hooks
   * (`useRecentTracks`/`useTopArtists`/`useFriends`/`useArtistInfo`) expose a retry
   * function — they fetch once off their dependencies — so no current call site
   * passes this; it exists for pages/hooks that gain one later. */
  readonly onRetry?: () => void;
}

export type AsyncStateProps = AsyncStateLoadingProps | AsyncStateEmptyProps | AsyncStateErrorProps;

/**
 * Shared loading/empty/error treatment for a page's (or a page section's) main async
 * content. Replaces what used to be three ad hoc, slightly-different-per-page
 * treatments — a bare `<CircularProgress size={24} />` floating at the content's left
 * edge with no centering, a bare `<Typography color="error">`, and a bare
 * `<Typography color="text.secondary">` for "nothing here" — with one deliberate,
 * consistent set of treatments. See NowPlayingPage/ScrobblesPage/ProfilePage/
 * FriendsPage for the call sites this replaced.
 */
export function AsyncState(props: AsyncStateProps): JSX.Element {
  if (props.kind === "loading") {
    return (
      <Box role="status" aria-live="polite" sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress aria-label={props.label ?? "Loading…"} />
      </Box>
    );
  }

  if (props.kind === "empty") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          py: 6,
          px: 2,
          color: "text.disabled",
        }}
      >
        {props.icon}
        <Typography color="text.secondary" sx={{ mt: 1.5 }}>
          {props.message}
        </Typography>
      </Box>
    );
  }

  return (
    <Alert
      severity="error"
      sx={{ my: 1 }}
      action={
        props.onRetry ? (
          <Button color="inherit" size="small" onClick={props.onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      {props.message}
    </Alert>
  );
}
