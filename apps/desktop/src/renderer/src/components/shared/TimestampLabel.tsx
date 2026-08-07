import { useMemo, type JSX } from "react";
import Box from "@mui/material/Box";
import { useShrinkToFitIndex } from "../../hooks/use-shrink-to-fit-index.js";
import {
  formatTimestampCandidates,
  TIMESTAMP_CHIP_MIN_WIDTH_CHARS,
} from "./format-timestamp-candidates.js";

export interface TimestampLabelProps {
  /** Unix seconds. */
  readonly timestamp: number;
}

/**
 * `PlaybackStatusChip`'s timestamp label — its own component (not inlined into that
 * file) specifically so `useShrinkToFitIndex`'s hook calls stay unconditional:
 * `PlaybackStatusChip` itself has early returns for its `nowPlaying`/neither-case
 * branches, and this is only ever *mounted* (not just conditionally reached inline)
 * when a timestamp actually needs showing — which is what makes calling hooks here
 * safe regardless of what `PlaybackStatusChip` does before or after rendering it.
 *
 * Renders the widest of `formatTimestampCandidates`'s progressively-shorter strings
 * that still fits the space available — see `useShrinkToFitIndex`'s own docstring for
 * how, and for the real jsdom-can't-prove-this-part limitation.
 *
 * `minWidth: TIMESTAMP_CHIP_MIN_WIDTH_CHARS` reserves room for the *terse* candidate
 * up front via ordinary CSS, rather than starting at zero width and only reacting
 * after the fact once `useShrinkToFitIndex`'s `ResizeObserver` detects real overflow —
 * a redundant, harmless second guarantee at the most specific level (this is the exact
 * element `useShrinkToFitIndex` measures), not the load-bearing one. The floor that
 * actually holds up under real layout pressure lives one level up, on
 * `PlaybackStatusChip`'s own `Chip` — see that component's docstring for why setting
 * it *only* here isn't enough (confirmed live, not assumed) and what the real fix is.
 * `overflow`/`textOverflow: "ellipsis"` here remains a true last resort.
 */
export function TimestampLabel({ timestamp }: TimestampLabelProps): JSX.Element {
  const candidates = useMemo(() => formatTimestampCandidates(timestamp), [timestamp]);
  const { containerRef, index } = useShrinkToFitIndex(candidates.length);
  // `index` is a plain `number`, not one of the four literal indices
  // `formatTimestampCandidates`'s tuple return type guarantees, so this indexed access
  // is `string | undefined` under `noUncheckedIndexedAccess` even though
  // `useShrinkToFitIndex` never actually returns an out-of-range index — the fallback
  // chain satisfies the type checker without a non-null assertion (banned by this
  // project's own eslint config) and is practically unreachable.
  const label = candidates[index] ?? candidates[0];

  return (
    <Box
      component="span"
      ref={containerRef}
      sx={{
        display: "block",
        minWidth: `${TIMESTAMP_CHIP_MIN_WIDTH_CHARS}ch`,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        // Centered, not left-aligned (the block default): a short candidate like "Now"
        // or "5m" rendered inside this reserved minimum width would otherwise hug the
        // left edge with visibly empty space to its right — centering reads as one
        // consistently-sized pill rather than a wide box with stray blank space.
        textAlign: "center",
      }}
    >
      {label}
    </Box>
  );
}
