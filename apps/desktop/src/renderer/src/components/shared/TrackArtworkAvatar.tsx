import type { JSX } from "react";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Avatar from "@mui/material/Avatar";

export interface TrackArtworkAvatarProps {
  readonly imageUrl: string | undefined;
  readonly title: string;
  /** Drives the fallback icon (play vs. note) and the fallback background/text color
   * — `primary`-tinted while playing, a neutral `action.selected` otherwise, matching
   * the "Now Playing"/"Scrobbling now" chip treatment next to it. */
  readonly nowPlaying: boolean;
  readonly size: number;
  /** `true` for callers inside a plain flex row (e.g. `FriendListItem`'s activity
   * card, which would otherwise let a long track/artist line squeeze the avatar
   * narrower than `size`); omitted for callers already inside MUI's `ListItemAvatar`
   * (e.g. `ScrobbleListItem`), which sizes itself and never needed this. */
  readonly flexShrink?: boolean;
}

/**
 * A track's real album art (`imageUrl`) when present, falling back to a play/note
 * icon on a solid `primary`/`action.selected` circle depending on `nowPlaying` — the
 * exact avatar treatment `ScrobbleListItem`'s row art and `FriendListItem`'s nested
 * activity-card art both need, previously duplicated between them byte-for-byte
 * apart from size. Lives in `components/shared/` because it replaces those two
 * separate copies (see `find-reusable-components`).
 *
 * Deliberately takes primitive props (`imageUrl`/`title`/`nowPlaying`) rather than a
 * whole `RecentTrack`, even though both current call sites happen to have one in
 * hand — keeps this component usable for any track-like source, not just Last.fm's
 * own type, matching `ArtistAvatar`'s existing `name`/`size` convention nearby.
 */
export function TrackArtworkAvatar({
  imageUrl,
  title,
  nowPlaying,
  size,
  flexShrink,
}: TrackArtworkAvatarProps): JSX.Element {
  return (
    <Avatar
      variant="rounded"
      src={imageUrl}
      alt={title}
      sx={{
        width: size,
        height: size,
        ...(flexShrink ? { flexShrink: 0 } : {}),
        bgcolor: nowPlaying ? "primary.main" : "action.selected",
        color: nowPlaying ? "primary.contrastText" : "text.secondary",
      }}
    >
      {nowPlaying ? <PlayArrowIcon fontSize="medium" /> : <MusicNoteIcon fontSize="medium" />}
    </Avatar>
  );
}
