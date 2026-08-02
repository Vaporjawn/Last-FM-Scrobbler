import type { JSX } from "react";
import Box from "@mui/material/Box";
import { keyframes } from "@mui/material/styles";

const BAR_INDEXES = [0, 1, 2] as const;

const bounce = keyframes`
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
`;

export interface ScrobblingIndicatorProps {
  /** Square footprint in px — defaults to a size that reads well as a small `Chip`'s
   * `icon`, its only current use (see FriendListItem/ScrobbleListItem). */
  readonly size?: number;
  /** MUI's `Chip` clones whatever it's given as `icon` and injects its own
   * `MuiChip-icon` class onto it (via `cloneElement(icon, { className: ... })`) to get
   * the icon's standard chip-relative spacing — the small negative margin that tucks a
   * real `SvgIcon` in against the chip's rounded edge without crowding the label. A
   * component only receives that injected class if it actually forwards `className`
   * onto its own root element; dropping it (as this component originally did) leaves
   * the icon flush against the chip's edge with no spacing from the label — exactly
   * the "cramped" look this prop exists to prevent. Always forward `className` through
   * to the root when building a component meant to be usable as a `Chip` `icon`. */
  readonly className?: string;
}

/**
 * A tiny animated three-bar equalizer — the classic "this is playing right now" visual
 * (Last.fm's own clients, Spotify, etc. all use some version of it) for "Scrobbling
 * now"/"Now Playing" chips, replacing the static play-triangle icon those chips used
 * before. Pure CSS `@keyframes` via emotion's `keyframes` helper — no animation
 * library, no image/SVG asset. `bgcolor: "currentColor"` means it always matches
 * whatever text color it's placed in (white on a `color="primary"` Chip), the same way
 * a real icon passed to `Chip`'s `icon` prop would. Each bar bounces at a slightly
 * different speed/delay so the three don't move in lockstep — a uniform pulse reads as
 * a loading spinner, not an equalizer. Respects `prefers-reduced-motion`, freezing on
 * a static "mid-level" bar pattern instead of animating.
 */
export function ScrobblingIndicator({ size = 14, className }: ScrobblingIndicatorProps): JSX.Element {
  return (
    <Box
      aria-hidden
      className={className}
      sx={{
        display: "inline-flex",
        alignItems: "flex-end",
        gap: "2px",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {BAR_INDEXES.map((index) => (
        <Box
          key={index}
          sx={{
            flex: 1,
            height: "100%",
            borderRadius: "1px",
            bgcolor: "currentColor",
            transformOrigin: "bottom",
            animation: `${bounce} ${0.9 + index * 0.15}s ease-in-out ${index * 0.12}s infinite`,
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
              transform: index === 1 ? "scaleY(1)" : "scaleY(0.55)",
            },
          }}
        />
      ))}
    </Box>
  );
}
