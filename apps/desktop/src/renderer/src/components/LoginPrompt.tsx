import type { JSX } from "react";
import SettingsIcon from "@mui/icons-material/Settings";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

export interface LoginPromptProps {
  /** View-specific reason, e.g. "...to see your scrobble history." */
  readonly message: string;
  readonly onNavigateToSettings: () => void;
}

/**
 * Shown on any view that needs an active Last.fm account before it has anything to
 * display (Scrobbles, Profile, Friends). Takes the user straight to Settings →
 * Accounts rather than just naming the page — telling someone where to go without
 * taking them there is an unnecessary extra click for something one button can do.
 */
export function LoginPrompt({ message, onNavigateToSettings }: LoginPromptProps): JSX.Element {
  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 1.5 }}>
        {message}
      </Typography>
      <Button
        variant="outlined"
        size="small"
        startIcon={<SettingsIcon fontSize="small" />}
        onClick={onNavigateToSettings}
      >
        Go to Settings
      </Button>
    </Box>
  );
}
