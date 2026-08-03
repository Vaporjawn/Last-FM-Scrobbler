import type { JSX, ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

/** Used for both `"list"` (an avatar's `width`/`height`) and, via `ArtworkTile`'s own
 * matching `borderRadius: 2`, kept in visual step with `"grid"`'s square tiles. Doesn't
 * try to match `ScrobbleListItem`'s 56px or `FriendListItem`'s 48px row avatar
 * exactly — one shared skeleton row shape approximates both close enough that the
 * difference isn't worth two near-identical variants. */
const SKELETON_ROW_AVATAR_SIZE = 48;
/** Reasonable default placeholder count for `"list"`/`"grid"` — enough to plausibly
 * fill a typical viewport without rendering an arbitrarily large number of DOM nodes
 * for content nobody will see before the real data replaces it. */
const DEFAULT_SKELETON_COUNT = 5;

interface AsyncStateLoadingProps {
  readonly kind: "loading";
  /** Visually-hidden-ish text for screen readers — `CircularProgress` alone has no
   * label of its own. Defaults to "Loading…"; pass something more specific ("Loading
   * scrobbles…") where it helps. */
  readonly label?: string;
  /** `"spinner"` (the default, and every existing call site's unchanged behavior) is a
   * single centered `CircularProgress` — right for content with no obvious placeholder
   * shape (a bio panel, a flat stat). `"list"`/`"grid"` instead render `count`
   * `Skeleton` placeholders shaped like the eventual content, for pages where that
   * shape is already known ahead of time (a row of scrobbles, a grid of artist tiles):
   * replacing the whole area with an unrelated spinner blob for a second reads as
   * "please wait"; a shape-matched placeholder reads as "content is arriving". */
  readonly variant?: "spinner" | "list" | "grid";
  /** How many placeholder rows/tiles to render for `"list"`/`"grid"` — ignored for
   * `"spinner"`. Defaults to `DEFAULT_SKELETON_COUNT`. */
  readonly count?: number;
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
    const variant = props.variant ?? "spinner";
    const label = props.label ?? "Loading…";

    if (variant === "list") {
      const rows = Array.from({ length: props.count ?? DEFAULT_SKELETON_COUNT });
      return (
        <Box role="status" aria-live="polite" aria-label={label}>
          {rows.map((_, index) => (
            <Stack
              key={index}
              direction="row"
              spacing={2}
              sx={{ alignItems: "center", py: 1.5 }}
            >
              <Skeleton
                variant="circular"
                width={SKELETON_ROW_AVATAR_SIZE}
                height={SKELETON_ROW_AVATAR_SIZE}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Skeleton variant="text" sx={{ fontSize: "0.875rem" }} width="45%" />
                <Skeleton variant="text" sx={{ fontSize: "0.875rem" }} width="70%" />
              </Box>
            </Stack>
          ))}
        </Box>
      );
    }

    if (variant === "grid") {
      const tiles = Array.from({ length: props.count ?? DEFAULT_SKELETON_COUNT });
      return (
        <Box
          role="status"
          aria-live="polite"
          aria-label={label}
          sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 2 }}
        >
          {tiles.map((_, index) => (
            <Skeleton
              key={index}
              variant="rounded"
              sx={{ width: "100%", aspectRatio: "1", borderRadius: 2 }}
            />
          ))}
        </Box>
      );
    }

    return (
      <Box role="status" aria-live="polite" sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress aria-label={label} />
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
