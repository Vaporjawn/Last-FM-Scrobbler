import type { JSX } from "react";
import StarIcon from "@mui/icons-material/Star";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";

export interface SubscriberAvatarProps {
  readonly src: string | undefined;
  readonly alt: string;
  /** Square footprint in px, applied as the inner `Avatar`'s `width`/`height`. The
   * subscriber badge's own icon size/padding scale proportionally from this (see
   * `deriveBadgeSizing` below) rather than being a second prop this component's
   * callers would have to keep in sync with `size` themselves. */
  readonly size: number;
  /** Letter shown when `src` is absent/fails to load — the same `Avatar`
   * `src`-falls-back-to-children convention used everywhere else in this app. */
  readonly fallbackInitial: string;
  readonly isSubscriber: boolean;
  /** Theme palette path for the fallback-letter background, e.g. `"action.selected"`
   * (`FriendListItem`) or `"primary.main"` (`ProfilePage`) — each call site's own
   * choice preserved exactly as it was before this component existed. */
  readonly bgcolor: string;
  /** Theme palette path for the fallback-letter text color — omitted (falls back to
   * `Avatar`'s own default) for callers that never set one, matching
   * `FriendListItem`'s current `color: "text.secondary"` vs. `ProfilePage`'s lack of
   * any override. */
  readonly color?: string;
  /** Fallback-letter font size override — omitted (falls back to `Avatar`'s own
   * default sizing) for callers that never set one, matching `FriendListItem`'s
   * current lack of an override vs. `ProfilePage`'s `fontSize: 32`. */
  readonly fontSize?: number;
  /** `true` for callers inside a plain flex row (both current call sites —
   * `FriendListItem`'s avatar/name row, `ProfilePage`'s account card — are), which
   * would otherwise let adjacent text squeeze this avatar narrower than `size`;
   * matches `TrackArtworkAvatar`'s own `flexShrink` prop/convention nearby. Applied to
   * whichever element actually ends up as the flex child — the bare `Avatar` when
   * `isSubscriber` is false, the wrapping `Badge` when it's true — since a `Badge`
   * wrapper is itself a flex item that needs the same protection its child would have
   * needed alone. */
  readonly flexShrink?: boolean;
}

/**
 * `size * 0.25 + 2` for the star's `fontSize` and `fontSize / 11` for its padding —
 * chosen because that's the exact line through this component's two original call
 * sites (14px icon / 1px padding at a 48px avatar in `FriendListItem`, 22px icon /
 * 2px padding at an 80px avatar in `ProfilePage`), so both keep their current
 * appearance pixel-for-pixel while a future third avatar size gets a badge that's
 * proportionally consistent with both rather than a guessed one-off value.
 */
function deriveBadgeSizing(avatarSize: number): { fontSize: number; padding: number } {
  const fontSize = avatarSize * 0.25 + 2;
  return { fontSize, padding: fontSize / 11 };
}

/**
 * An `Avatar` with Last.fm's "Pro subscriber" star pinned to its bottom-right corner
 * via MUI's `Badge` component — replaces what `FriendListItem` and `ProfilePage` used
 * to each hand-roll independently (a `position: relative` wrapper `Box` plus a
 * `position: absolute` `StarIcon`, byte-for-byte the same treatment in both places;
 * `ProfilePage`'s own old comment literally said "same treatment as FriendListItem's
 * avatar"). Renders a plain `Avatar` with no `Badge` wrapper at all when
 * `isSubscriber` is false, rather than a `Badge` with empty/invisible content — there
 * being nothing to badge, there's nothing to gain from the extra wrapping element.
 *
 * Takes explicit `bgcolor`/`color`/`fontSize` props rather than a generic pass-through
 * `sx`, matching `TrackArtworkAvatar`'s own convention nearby: this component's real
 * job is composing `Avatar` + `Badge` correctly, and the small, known set of style
 * knobs its two call sites actually vary is easier to keep type-safe (and to see the
 * full set of at a glance) as named props than as an arbitrary merged `sx` value.
 */
export function SubscriberAvatar({
  src,
  alt,
  size,
  fallbackInitial,
  isSubscriber,
  bgcolor,
  color,
  fontSize,
  flexShrink = false,
}: SubscriberAvatarProps): JSX.Element {
  const avatar = (
    <Avatar
      src={src}
      alt={alt}
      sx={{
        width: size,
        height: size,
        bgcolor,
        ...(flexShrink ? { flexShrink: 0 } : {}),
        ...(color ? { color } : {}),
        ...(fontSize ? { fontSize } : {}),
      }}
    >
      {fallbackInitial}
    </Avatar>
  );

  if (!isSubscriber) {
    return avatar;
  }

  const { fontSize: badgeFontSize, padding } = deriveBadgeSizing(size);

  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      sx={{
        ...(flexShrink ? { flexShrink: 0 } : {}),
        // Resets Badge's own dot-shaped slot chrome (background color, min-width/
        // height, padding — all sized for a small numeric/status dot) so the only
        // visible chrome is the StarIcon's own circular white background below;
        // without this, MUI's default badge styling and the icon's own would double up.
        "& .MuiBadge-badge": { p: 0, minWidth: 0, height: "auto", bgcolor: "transparent" },
      }}
      badgeContent={
        <StarIcon
          titleAccess="Last.fm Pro subscriber"
          sx={{
            fontSize: badgeFontSize,
            color: "warning.main",
            bgcolor: "background.paper",
            borderRadius: "50%",
            p: `${padding}px`,
          }}
        />
      }
    >
      {avatar}
    </Badge>
  );
}
