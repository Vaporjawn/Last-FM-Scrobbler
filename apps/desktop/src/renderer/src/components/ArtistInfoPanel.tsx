import type { JSX } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ArtistInfo, SimilarArtist } from "@lastfm-scrobbler/core";
import { stripHtml } from "../utils/strip-html.js";
import { ArtistAvatar } from "./ArtistAvatar.js";
import { AsyncState } from "./AsyncState.js";

const SIMILAR_ARTIST_AVATAR_SIZE = 72;

export interface ArtistInfoPanelProps {
  readonly artistName: string;
  readonly info: ArtistInfo | undefined;
  readonly similarArtists: readonly SimilarArtist[];
  readonly loading: boolean;
  readonly error: string | undefined;
  /** Popular community tags (see `LastfmClient.getTopTags`) — omitted entirely (no
   * "Popular tags" row at all, not an empty one) when the caller doesn't have any to
   * show. NowPlayingPage doesn't fetch these today, so it simply doesn't pass this
   * prop; ScrobbleDetailPage does. */
  readonly topTags?: readonly string[];
}

/**
 * An artist's bio, listener/play stats, popular tags, and similar artists — the panel
 * NowPlayingPage has always shown under the currently-playing track, now shared with
 * `ScrobbleDetailPage` so a past scrobble gets the identical treatment rather than a
 * second, slightly-different copy of the same ~70 lines of JSX. Real per-artist photos
 * throughout (see `ArtistAvatar`) — Last.fm's own artist-image field is a shared
 * placeholder (see `ArtistInfo`'s docstring in `packages/core`), so these come from
 * Deezer instead.
 */
export function ArtistInfoPanel({
  artistName,
  info,
  similarArtists,
  loading,
  error,
  topTags,
}: ArtistInfoPanelProps): JSX.Element {
  const artistLastfmUrl = `https://www.last.fm/music/${encodeURIComponent(artistName)}`;
  const bioSummary = info?.bioSummary ? stripHtml(info.bioSummary) : undefined;

  return (
    <Stack direction="row" spacing={3} sx={{ alignItems: "flex-start" }}>
      <ArtistAvatar name={artistName} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="h6" gutterBottom>
          {artistName}
        </Typography>

        {loading ? (
          <AsyncState kind="loading" label="Loading artist info…" />
        ) : error ? (
          <AsyncState kind="error" message={error} />
        ) : info ? (
          <>
            {bioSummary ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {bioSummary}
              </Typography>
            ) : null}
            <Link href={artistLastfmUrl} target="_blank" rel="noreferrer" sx={{ fontWeight: 600 }}>
              Read more on Last.fm
            </Link>

            <Stack direction="row" spacing={4} sx={{ mt: 2.5 }}>
              <Box>
                <Typography variant="h6">{info.listeners.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Listener(s)
                </Typography>
              </Box>
              <Box>
                <Typography variant="h6">{info.playCount.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Play(s)
                </Typography>
              </Box>
            </Stack>

            {topTags && topTags.length > 0 ? (
              <Box sx={{ mt: 2.5 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Popular Tags
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                  {topTags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      variant="outlined"
                      component="a"
                      href={`https://www.last.fm/tag/${encodeURIComponent(tag)}`}
                      target="_blank"
                      rel="noreferrer"
                      clickable
                    />
                  ))}
                </Stack>
              </Box>
            ) : null}

            {similarArtists.length > 0 ? (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Similar Artists
                </Typography>
                <Stack direction="row" spacing={2.5} sx={{ flexWrap: "wrap" }}>
                  {similarArtists.map((similarArtist) => (
                    <Stack
                      key={similarArtist.name}
                      spacing={0.5}
                      sx={{ alignItems: "center", width: SIMILAR_ARTIST_AVATAR_SIZE + 24 }}
                    >
                      <ArtistAvatar name={similarArtist.name} size={SIMILAR_ARTIST_AVATAR_SIZE} />
                      <Typography variant="caption" align="center" sx={{ wordBreak: "break-word" }}>
                        {similarArtist.name}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ) : null}
          </>
        ) : (
          <AsyncState
            kind="empty"
            icon={<InfoOutlinedIcon sx={{ fontSize: 48 }} />}
            message="No additional artist info available."
          />
        )}
      </Box>
    </Stack>
  );
}
