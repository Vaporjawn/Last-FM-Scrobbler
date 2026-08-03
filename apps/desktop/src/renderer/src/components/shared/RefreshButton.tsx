import type { JSX } from "react";
import RefreshIcon from "@mui/icons-material/Refresh";
import IconButton from "@mui/material/IconButton";
import { keyframes } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export interface RefreshButtonProps {
  readonly onRefresh: () => void;
  /** Spins the icon and disables the button while `true` — a page's own `refreshing`
   * flag (or an OR of several, for a header that refreshes more than one section at
   * once — see NowPlayingPage). Deliberately not `loading`: the whole point of a
   * refresh control is to sit next to content that's already on screen, so it should
   * only reflect a manually-triggered re-fetch, not the page's very first load (see
   * `LastfmFetchState.refreshing`'s own docstring for why the two are kept apart). */
  readonly refreshing: boolean;
  /** Both the button's `aria-label` and its tooltip text — defaults to "Refresh";
   * pass something more specific ("Refresh friends") where a page has more than one
   * independent refresh control and a bare "Refresh" would be ambiguous to someone
   * using a screen reader. */
  readonly label?: string;
}

/**
 * A small icon button that spins while `refreshing` and calls `onRefresh` when
 * clicked — the one control every page's `PageHeader` `action` slot (or a section
 * header, for a page with more than one independently-refreshable area — see
 * ProfilePage's Top Artists/Top Albums view-mode `Select`s for the same "control
 * lives next to the thing it affects" precedent) passes through to a data hook's own
 * `refetch`. Pure CSS `@keyframes` via emotion's `keyframes` helper, same technique
 * (and the same `prefers-reduced-motion` respect) as `ScrobblingIndicator` — a
 * spinning icon is exactly the kind of animation that skill exists to guard.
 */
export function RefreshButton({ onRefresh, refreshing, label = "Refresh" }: RefreshButtonProps): JSX.Element {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton size="small" onClick={onRefresh} disabled={refreshing} aria-label={label}>
          <RefreshIcon
            fontSize="small"
            sx={{
              ...(refreshing
                ? {
                    animation: `${spin} 0.9s linear infinite`,
                    "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                  }
                : {}),
            }}
          />
        </IconButton>
      </span>
    </Tooltip>
  );
}
