import type { JSX } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export interface StatBoxProps {
  /** Already formatted for display (e.g. `count.toLocaleString()`) — this component
   * doesn't know or care whether the underlying value is a number, since every call
   * site already needed to format it its own way before rendering. */
  readonly value: string;
  readonly label: string;
  /** Typography variant for `value` — callers differed here before this was shared
   * (`ArtistInfoPanel` used `"h6"`, `NowPlayingPage` used `"subtitle1"` for the same
   * concept at a slightly smaller scale next to more surrounding text), so this stays
   * a prop rather than being hardcoded to either caller's prior choice. */
  readonly variant?: "h6" | "subtitle1";
}

/**
 * A single stat: a prominent value with a small caption label underneath — the
 * listener/play-count pairs `ArtistInfoPanel` shows twice (artist listeners, artist
 * plays) and `NowPlayingPage` shows twice more (track listeners, track plays), all
 * four previously the same four-line `Box`/`Typography` pair typed out separately.
 * Lives in `components/shared/` because it replaces those four separate copies (see
 * `find-reusable-components`).
 */
export function StatBox({ value, label, variant = "h6" }: StatBoxProps): JSX.Element {
  return (
    <Box>
      <Typography variant={variant}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
