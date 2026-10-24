import { type JSX } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

/** Purely presentational visual anchor for the app's persistent chrome — no props
 * beyond `collapsed`, no click behavior. `/favicon.png` (served from `public/`) is
 * byte-identical to `resources/app-icon.png` (verified via `shasum`) — the same mark
 * used for the dock/window icon — so this reuses it directly rather than duplicating
 * the asset under a second name. */
export function SidebarHeader({ collapsed }: { readonly collapsed: boolean }): JSX.Element {
  const icon = (
    <Box
      component="img"
      src="/favicon.png"
      alt="Last.fm Scrobbler"
      sx={{ width: 28, height: 28, borderRadius: 0.75, flexShrink: 0 }}
    />
  );

  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        px: collapsed ? 2 : 3,
        py: 2,
      }}
    >
      {icon}
      {collapsed ? null : (
        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
          Last.fm
        </Typography>
      )}
    </Stack>
  );
}
