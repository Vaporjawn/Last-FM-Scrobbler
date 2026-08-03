import { useMemo, type JSX } from "react";
import Box from "@mui/material/Box";
import { useShrinkToFitIndex } from "../../hooks/use-shrink-to-fit-index.js";
import { formatTimestampCandidates } from "./format-timestamp-candidates.js";

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
 * `overflow`/`textOverflow: "ellipsis"` here is a last-resort safety net, not the
 * primary mechanism: it only ever engages if even the shortest candidate (currently
 * just a bare time, e.g. "2:45 PM") still doesn't fit.
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
      sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
    >
      {label}
    </Box>
  );
}
