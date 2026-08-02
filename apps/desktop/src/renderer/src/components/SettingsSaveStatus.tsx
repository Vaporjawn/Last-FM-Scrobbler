import type { JSX } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export type SettingsSaveState = "saved" | "saving" | "error";

export interface SettingsSaveStatusProps {
  readonly state: SettingsSaveState;
}

const LABEL: Record<SettingsSaveState, string> = {
  saved: "All changes saved",
  saving: "Saving…",
  error: "Couldn't save",
};

// `primary`/`secondary` rather than MUI's default `success`/`warning` — this theme
// never defines those two, so they'd fall back to generic Material green/orange,
// exactly the "reads as generic Material" look theme/index.ts's own comments say this
// app deliberately avoids. Reusing the app's actual palette instead: red for the
// steady-state "saved" (this app's one brand color, standing in for "confirmed/good"
// the same way it already does for active/selected states elsewhere), amber for the
// transient "saving" — which happens to land close to the reference design's own
// amber "saving" color anyway.
const COLOR: Record<SettingsSaveState, string> = {
  saved: "primary.main",
  saving: "secondary.main",
  error: "error.main",
};

/**
 * Small dot + label in `SettingsPage`'s header, reflecting the real in-flight state
 * of `useSettings().updateSettings()` — not a simulated/decorative indicator. See
 * `SettingsPage`'s `handleUpdateSetting` for how `state` is driven.
 */
export function SettingsSaveStatus({ state }: SettingsSaveStatusProps): JSX.Element {
  const color = COLOR[state];
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, whiteSpace: "nowrap" }}>
      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ color, fontWeight: 600 }}>
        {LABEL[state]}
      </Typography>
    </Box>
  );
}
