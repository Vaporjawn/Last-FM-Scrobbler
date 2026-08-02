import type { JSX } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function PreferencesPage(): JSX.Element {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Preferences
      </Typography>
      <Typography color="text.secondary">
        Coming soon — see docs/modules/desktop.md for the planned view.
      </Typography>
    </Box>
  );
}
