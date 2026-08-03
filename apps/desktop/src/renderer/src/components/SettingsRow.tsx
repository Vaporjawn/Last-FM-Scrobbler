import type { JSX, ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export interface SettingsRowProps {
  readonly label: string;
  readonly description?: ReactNode;
  /** An optional visual on the row's leading edge, before the label/description — an
   * `Avatar` for an account row's profile photo, e.g. Omitted entirely (not just an
   * empty slot) for rows that don't need one, like the General/Window section's plain
   * toggle rows. */
  readonly leading?: ReactNode;
  /** The actual control — `Switch`, `Button`, a `Radio`+`Button` pair, etc. Rendered
   * as-is on the row's trailing edge; this component only handles the label/
   * description/divider chrome around it. */
  readonly control: ReactNode;
}

/**
 * One label-left, control-right row inside a `SettingsSectionCard` — every row gets
 * a bottom divider (including the last one in a section; the card's own smaller
 * bottom padding accounts for that, matching the reference design exactly rather
 * than special-casing "is this the last row").
 */
export function SettingsRow({ label, description, leading, control }: SettingsRowProps): JSX.Element {
  return (
    <Box
      sx={{
        display: "flex",
        // `flexWrap: "wrap"` rather than a breakpoint: `control` ranges from a small
        // `Switch` up to a multi-button `Stack` (e.g. SettingsPage's Libre.fm "log in"
        // row, which can show both a long "Waiting for approval on Libre.fm…" button
        // and a "Remove saved key" button at once) — and this row's own available
        // width already varies with SettingsPage's own 1-column/2-column grid
        // breakpoint, so a *second*, independently-guessed breakpoint here would risk
        // the same "doesn't actually match the real available width" bug that `md`
        // (not `sm`) fixed elsewhere in this app (see ScrobbleDetailPage's comment).
        // Wrapping only when content genuinely doesn't fit — rather than at a fixed
        // width threshold — adapts correctly to whichever container this row ends up
        // in without needing to know about it.
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        rowGap: 1,
        py: 1.25,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        {leading ?? null}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {label}
          </Typography>
          {description ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {description}
            </Typography>
          ) : null}
        </Box>
      </Box>
      <Box sx={{ flexShrink: 0 }}>{control}</Box>
    </Box>
  );
}
