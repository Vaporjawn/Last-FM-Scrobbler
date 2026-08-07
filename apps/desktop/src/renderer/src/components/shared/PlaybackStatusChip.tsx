import type { JSX } from "react";
import Chip from "@mui/material/Chip";
import type { SxProps, Theme } from "@mui/material/styles";
import { ScrobblingIndicator } from "../ScrobblingIndicator.js";
import { TIMESTAMP_CHIP_MIN_WIDTH_CHARS } from "./format-timestamp-candidates.js";
import { TimestampLabel } from "./TimestampLabel.js";

// `size="small"` + `variant="outlined"` — the exact variant the timestamp `Chip` below
// always renders as — pads its `.MuiChip-label` 7px on each side (14px total) plus a
// 1px border on each side (2px total); see `@mui/material/Chip`'s own source for both
// (not guessed — this project's own "verify, don't assume" standard applies to a
// vendored library's internal styling just as much as to its own code). Added on top
// of `TIMESTAMP_CHIP_MIN_WIDTH_CHARS` so the *chip's* reserved minimum comfortably
// covers its label's content-width floor plus this chrome, not just the content floor
// alone — see this component's own docstring for why the floor has to live here, on
// the `Chip` itself, and not only on `TimestampLabel`'s inner element.
const TIMESTAMP_CHIP_DEFAULT_SX = { minWidth: `calc(${TIMESTAMP_CHIP_MIN_WIDTH_CHARS}ch + 16px)` } as const;

/**
 * A hand-written type guard, not a bare `Array.isArray(value)` check inline — the
 * built-in `Array.isArray` overload in `lib.es5.d.ts` always narrows its true branch
 * to a bare `any[]`, which would leak an implicit `any` into the spread this guards
 * below. Narrows to `SxProps<Theme>`'s own array member (via `Extract`, not a
 * hand-reconstructed element type — see the `as SxProps<Theme>` below for why that's
 * not worth chasing) — a predicate's asserted type has to be a subtype of its
 * parameter's, which a bare `readonly unknown[]` isn't.
 */
function isSxArray(
  value: SxProps<Theme> | undefined,
): value is Extract<SxProps<Theme>, readonly unknown[]> {
  return Array.isArray(value);
}

export interface PlaybackStatusChipProps {
  readonly nowPlaying: boolean;
  /** When this track was scrobbled — ignored while `nowPlaying` is true. Renders
   * nothing at all (not an empty chip) when both this and `nowPlaying` are absent/
   * false, same as every call site's previous plain-conditional behavior. */
  readonly timestamp: number | undefined;
  /** "Now Playing" (ScrobbleListItem's own track) vs "Scrobbling now" (someone else's,
   * on FriendListItem) — the two existing call sites' labels differ, and neither
   * reads right for the other's context, so this isn't hardcoded. */
  readonly nowPlayingLabel: string;
  readonly sx?: SxProps<Theme>;
}

/**
 * A track row's trailing status indicator: a filled, pulsing-dot `Chip` while
 * `nowPlaying`, or a plain outlined `Chip` showing when it was scrobbled otherwise —
 * previously a `Chip` for the first case but plain `Typography` caption text for the
 * second, on both `ScrobbleListItem` and `FriendListItem`'s activity card
 * byte-for-byte identically apart from the label. Unified into one chip-shaped
 * element for both states, and pulled out here since both rows need the exact same
 * choice between them.
 *
 * `role="status"` on the `nowPlaying` chip specifically (not the timestamp one — a
 * static "when this happened" fact isn't a live status update ARIA's `status` role is
 * for) means assistive tech announces it the moment a row's live state changes,
 * without the caller needing its own wrapping element for that — `FriendListItem`'s
 * activity card used to hand-roll exactly this (a `role="status"` `Box` around a bare
 * `ScrobblingIndicator`) before it adopted this shared chip instead.
 *
 * The timestamp chip's label is `TimestampLabel`, not a plain string: at the narrow
 * row widths this app has to support, a fixed full-precision timestamp
 * ("8/3/2026, 2:45:30 PM") would otherwise get silently cut mid-character by the
 * `Chip`'s own default `text-overflow: ellipsis`. `TimestampLabel` instead steps down
 * through progressively shorter but always fully-formed strings as its actual
 * available width shrinks — relative "time ago" phrasing for anything scrobbled in
 * the last 24 hours, dropping seconds/the year/the date entirely for anything older —
 * see its own docstring and `format-timestamp-candidates.ts`.
 *
 * This `Chip` itself (not just `TimestampLabel`'s inner element) carries an explicit
 * `minWidth` reserving room for the shortest ("terse") candidate. Confirmed live (this
 * app's row layouts squeeze tightly enough in narrow windows that it matters in
 * practice, not just in theory) that reserving the floor *only* on `TimestampLabel`'s
 * own nested `<span>` isn't enough: `ScrobbleListItem`/`FriendListItem`'s row layouts
 * give the love/tag/timestamp column an explicit `minWidth: 0` (so the *artist/track*
 * text can shrink instead of fighting the chip for space — see those files' own
 * docstrings), and once an ancestor several levels up opts out of the browser's
 * automatic content-based minimum like that, a `min-width` set on a deeply nested
 * descendant doesn't reliably propagate back up through every intermediate flex
 * container to protect it — each container's own available cross-axis space can still
 * get clamped down by an even-further-out ancestor's flex-shrink resolution,
 * independent of what a child three levels down asks for. Verified directly via
 * Playwright with a scratch harness reproducing both rows' real layout at
 * width-scarce widths (down to 140px) before landing on setting the floor here, on the
 * chip itself, which — being the flex item actually living inside that `minWidth: 0`
 * column — is the one level where an explicit `min-width` is guaranteed to hold: the
 * CSS Flexbox spec has an explicit `min-width` on a flex item always win over the
 * automatic (`auto`) one during shrink resolution, regardless of what any ancestor
 * sets.
 */
export function PlaybackStatusChip({
  nowPlaying,
  timestamp,
  nowPlayingLabel,
  sx,
}: PlaybackStatusChipProps): JSX.Element | null {
  if (nowPlaying) {
    return (
      <Chip
        role="status"
        aria-label={nowPlayingLabel}
        icon={<ScrobblingIndicator />}
        label={nowPlayingLabel}
        size="small"
        color="primary"
        sx={sx}
      />
    );
  }
  if (timestamp !== undefined) {
    // Array form, not object-spread — `sx` (a caller-provided override, e.g.
    // `FriendListItem`'s `{ flexShrink: 0 }`) is `SxProps<Theme>`, which can itself be
    // an array or a theme-callback function, neither of which `{ ...sx }` would spread
    // correctly. MUI merges an array of `sx` entries in order, so this reserves the
    // minimum width as a default that a later entry in the array (whatever the caller
    // passed) can still override. Flattened one level (via `isSxArray`), not nested
    // (`[..., sx]` with `sx` itself an array as a single element) — MUI's own
    // `sx`-array handling (`@mui/system/styleFunctionSx`) only flattens one level
    // itself, so a nested array would have its own indices misread as CSS property
    // names.
    //
    // `as SxProps<Theme>`: verified correct at runtime (this exact merge, live in a
    // real browser via Playwright — see this component's own docstring), not asserted
    // blindly. `Chip`'s `sx` prop is plainly declared `SxProps<Theme> | undefined` in
    // its own source, but this MUI version's *actual* type-checking for it resolves
    // through an evolved, CSS-variable-aware shape TypeScript's structural checker
    // can't reconcile with a manually-assembled array literal — every attempt to
    // reconstruct that exact shape by hand (extracting it from `SxProps<Theme>`
    // directly, from `Chip`'s own resolved prop type, narrowing through intermediate
    // variables) hit the same mismatch, which is the type checker fighting MUI's own
    // internal type surface, not a sign this merge is actually unsound.
    const timestampChipSx = [
      TIMESTAMP_CHIP_DEFAULT_SX,
      ...(isSxArray(sx) ? sx : sx ? [sx] : []),
    ] as SxProps<Theme>;
    return (
      <Chip
        label={<TimestampLabel timestamp={timestamp} />}
        size="small"
        variant="outlined"
        sx={timestampChipSx}
      />
    );
  }
  return null;
}
