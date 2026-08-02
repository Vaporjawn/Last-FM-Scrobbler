import type { JSX } from "react";
import Avatar from "@mui/material/Avatar";
import { useArtistImage } from "../hooks/use-artist-image.js";

export interface ArtistAvatarProps {
  readonly name: string;
  readonly size?: number;
}

/**
 * An artist's real photo (via `useArtistImage` — Deezer's public artist search, not
 * Last.fm; see that hook's docstring for why) when one can be found, falling back to
 * the artist's initial on a plain colored circle otherwise — the same
 * `src`-falls-back-to-children pattern already used for `UserProfile.avatarUrl`/
 * `Friend.avatarUrl` elsewhere in this app, which *are* real Last.fm photos. Used for
 * both a page's main artist and each similar-artist thumbnail; every instance fetches
 * its own image independently (each is its own component instance with its own
 * `useArtistImage` call), which is exactly what makes a shared component like this the
 * right shape for a list of similar artists — no hook-in-a-loop problem, no page-level
 * batching needed.
 */
export function ArtistAvatar({ name, size = 96 }: ArtistAvatarProps): JSX.Element {
  const imageUrl = useArtistImage(name);

  return (
    <Avatar
      src={imageUrl}
      alt={name}
      sx={{
        width: size,
        height: size,
        fontSize: size / 2.4,
        bgcolor: "action.selected",
        color: "text.secondary",
        flexShrink: 0,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </Avatar>
  );
}
