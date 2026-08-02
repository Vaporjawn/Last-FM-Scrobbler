import type { JSX } from "react";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import type { RecentTrack } from "@lastfm-scrobbler/core";
import { PlaybackStatusChip } from "./shared/PlaybackStatusChip.js";
import { TrackArtworkAvatar } from "./shared/TrackArtworkAvatar.js";
import { TrackLoveTagControls } from "./shared/TrackLoveTagControls.js";

/** Row avatar size — bumped up from MUI's 40px default so real album art actually
 * reads at list scale instead of looking like a favicon. */
const AVATAR_SIZE = 56;

export interface ScrobbleListItemProps {
  readonly track: RecentTrack;
  /** Opens `ScrobbleDetailPage` for this track when given — the avatar/text portion of
   * the row becomes a real, keyboard-accessible button (`ListItemButton`); the
   * love/tag actions stay plain sibling buttons rather than nesting inside it (nesting
   * a button in a button is invalid HTML and breaks keyboard/AT navigation), so
   * clicking them acts on the track without also opening the detail page. Omitted
   * entirely (row stays non-interactive, exactly as before this prop existed) by any
   * caller that doesn't have anywhere to navigate to. */
  readonly onSelect?: (track: RecentTrack) => void;
}

/**
 * One row of `ScrobblesPage`'s history list. Shows Last.fm's own album art when it has
 * any on file (`track.imageUrl` — `Avatar`'s `src` falls back to the plain note/play
 * icon automatically when it's absent or fails to load), and wires up love/tag actions
 * via the shared `TrackLoveTagControls` (see there for why the same pair also appears
 * on `NowPlayingPage`/`ScrobbleDetailPage`) — just scoped to this row's own track.
 * Unlike the now-playing case, this row seeds the heart's initial state from
 * `track.loved`, Last.fm's real per-track status (see `RecentTrack.loved`'s
 * docstring), not a guess.
 */
export function ScrobbleListItem({ track, onSelect }: ScrobbleListItemProps): JSX.Element {
  const avatar = (
    <ListItemAvatar>
      <TrackArtworkAvatar
        imageUrl={track.imageUrl}
        title={track.track}
        nowPlaying={track.nowPlaying}
        size={AVATAR_SIZE}
      />
    </ListItemAvatar>
  );
  const text = (
    <ListItemText
      primary={track.track}
      secondary={`${track.artist}${track.album ? ` — ${track.album}` : ""}`}
    />
  );

  return (
    <ListItem divider disablePadding={Boolean(onSelect)}>
      {onSelect ? (
        <ListItemButton
          onClick={() => {
            onSelect(track);
          }}
          aria-label={`View details for ${track.track}`}
          sx={{ minWidth: 0 }}
        >
          {avatar}
          {text}
        </ListItemButton>
      ) : (
        <>
          {avatar}
          {text}
        </>
      )}

      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", ml: 1, mr: onSelect ? 2 : 0, flexShrink: 0 }}>
        <TrackLoveTagControls
          artist={track.artist}
          track={track.track}
          initialLoved={track.loved}
          trackLabel={track.track}
          tagPopoverAnchorHorizontal="right"
        />

        <PlaybackStatusChip
          nowPlaying={track.nowPlaying}
          timestamp={track.timestamp}
          nowPlayingLabel="Now Playing"
          sx={{ ml: 1 }}
        />
      </Stack>
    </ListItem>
  );
}
