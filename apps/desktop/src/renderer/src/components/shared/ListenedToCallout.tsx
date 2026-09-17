import type { JSX } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

export interface ListenedToCalloutProps {
  readonly artistName: string;
  readonly trackName: string;
  /** The logged-in account's own play count for the artist/track (see
   * `ArtistInfo.userPlayCount`/`TrackDetail.userPlayCount`'s docstrings) —
   * `undefined` when nobody's logged in or Last.fm has no count on file for this
   * account. A count of exactly `0` is treated the same as `undefined`: "you've
   * listened to this 0 times" carries no information worth showing (nothing to
   * place this track/artist within the listener's own history), so it's omitted
   * rather than rendered literally. */
  readonly artistPlayCount: number | undefined;
  readonly trackPlayCount: number | undefined;
  /** Top margin in MUI spacing units — each caller's surrounding layout differs in
   * whether the preceding element already supplies its own bottom margin, so this
   * stays a prop rather than a value baked into the component. Omit for none. */
  readonly mt?: number;
}

/**
 * "You've listened to X N times and Y M times." — the small bordered callout both
 * NowPlayingPage and ScrobbleDetailPage show near their hero artwork once the active
 * account's own play counts are known. Shared here (rather than kept as two
 * copy-pasted ~25-line JSX blocks, which is how this started) so the zero-count
 * omission rule above only has to be correct in one place. Renders nothing at all —
 * not an empty `Paper` — when neither count is present/positive.
 */
export function ListenedToCallout({
  artistName,
  trackName,
  artistPlayCount,
  trackPlayCount,
  mt,
}: ListenedToCalloutProps): JSX.Element | null {
  const hasArtistCount = artistPlayCount !== undefined && artistPlayCount > 0;
  const hasTrackCount = trackPlayCount !== undefined && trackPlayCount > 0;

  if (!hasArtistCount && !hasTrackCount) {
    return null;
  }

  return (
    <Paper
      variant="outlined"
      sx={{ mt, p: 1.5, display: "inline-block", bgcolor: "background.default" }}
    >
      <Typography variant="body2">
        You've listened to{" "}
        {hasArtistCount ? (
          <>
            <strong>{artistName}</strong> {artistPlayCount.toLocaleString()} time
            {artistPlayCount === 1 ? "" : "s"}
          </>
        ) : null}
        {hasArtistCount && hasTrackCount ? " and " : null}
        {hasTrackCount ? (
          <>
            <strong>{trackName}</strong> {trackPlayCount.toLocaleString()} time
            {trackPlayCount === 1 ? "" : "s"}
          </>
        ) : null}
        .
      </Typography>
    </Paper>
  );
}
