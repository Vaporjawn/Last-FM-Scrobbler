import type { JSX, ReactNode } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

export interface SettingsSectionCardProps {
  /** Small MUI icon element shown in the rounded badge next to the title — matches
   * the icon-badge treatment `ArtistAvatar`/`ScrobbleListItem` already use for
   * `Avatar variant="rounded"`, just themed to `primary.main` instead of album art. */
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
  /** Spans both columns of `SettingsPage`'s grid — for sections with either enough
   * static content (the API key form's two fields) or dynamic content (Accounts'
   * per-account rows, whose count isn't known up front) that a half-width column
   * would cramp them. Mirrors the reference design's own split: identity/integration
   * sections go full width, simple toggle/select groups go half width. */
  readonly fullWidth?: boolean;
  readonly children: ReactNode;
}

/**
 * One card in `SettingsPage`'s grid — icon badge + title + optional description,
 * `Divider`-free (the reference design relies on the icon row's own spacing rather
 * than a rule under it), then whatever section-specific content the caller renders.
 * Built on `Paper variant="outlined"` rather than a hand-rolled bordered `Box` so it
 * automatically tracks this app's real theme (`background.paper`, `divider`,
 * `shape.borderRadius`) instead of hardcoding a one-off copy of those values — the
 * same component every other card-like surface in this app (ScrobblesPage,
 * FriendsPage, the old Settings sections) already uses.
 */
export function SettingsSectionCard({
  icon,
  title,
  description,
  fullWidth,
  children,
}: SettingsSectionCardProps): JSX.Element {
  return (
    <Paper
      variant="outlined"
      sx={{
        gridColumn: fullWidth ? "1 / -1" : "auto",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        pt: 2.25,
        px: 2.5,
        pb: 1.25,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Avatar
          variant="rounded"
          sx={{
            width: 34,
            height: 34,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
            color: "primary.main",
          }}
        >
          {icon}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1">{title}</Typography>
          {description ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {description}
            </Typography>
          ) : null}
        </Box>
      </Box>
      {children}
    </Paper>
  );
}
