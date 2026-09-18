import type { JSX } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

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

// `secondary.main` (`#c9932e`, theme/index.ts) is one fixed value shared by both theme
// modes, tuned for the ~6.5–7:1 it gets against this app's near-black dark-mode
// background — but that leaves it at only ~2.6:1 against light mode's
// background.default/paper (`#faf8f5`/`#ffffff`), well under WCAG AA's 4.5:1 minimum
// for this caption-sized (13px) label. Darkening it enough to clear 4.5:1 in light mode
// pushes dark-mode contrast the other way below 4.5:1 (verified: same hue/saturation,
// stepped lightness — the two requirements can't be met by one static hex), so this has
// to vary by mode, not just get a single replacement value. Hand-picked (not MUI's
// auto-contrast) the same way theme/index.ts hand-picks `secondary.contrastText`: a
// darkened, same-hue amber that clears 4.5:1 against both light.default and
// light.paper (4.98:1 / 5.28:1, verified against theme/index.ts's `LIGHT_BACKGROUND`).
// Dark mode keeps `secondary.main` as-is — already well clear of 4.5:1 there
// (6.51:1 / 7.14:1 against `DARK_BACKGROUND`). Scoped to this label only: the status
// dot next to it has no text-contrast requirement, so it stays on the brand amber via
// `COLOR.saving` for visual consistency with the "saved"/"error" dots.
const SAVING_TEXT_LIGHT_MODE = "#8b6520";

/**
 * Small dot + label in `SettingsPage`'s header, reflecting the real in-flight state
 * of `useSettings().updateSettings()` — not a simulated/decorative indicator. See
 * `SettingsPage`'s `handleUpdateSetting` for how `state` is driven.
 */
export function SettingsSaveStatus({ state }: SettingsSaveStatusProps): JSX.Element {
  const { palette } = useTheme();
  const dotColor = COLOR[state];
  const textColor =
    state === "saving" && palette.mode === "light" ? SAVING_TEXT_LIGHT_MODE : dotColor;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, whiteSpace: "nowrap" }}>
      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: dotColor, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ color: textColor, fontWeight: 600 }}>
        {LABEL[state]}
      </Typography>
    </Box>
  );
}
