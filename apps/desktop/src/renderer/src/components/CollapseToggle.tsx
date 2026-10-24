import { type JSX } from "react";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

/** The collapse toggle used to be its own full-width row in the bottom `List`,
 * visually indistinguishable from a real navigation destination (same icon+label
 * treatment as Settings/Report a Bug) even though it isn't one. Floating it on the
 * sidebar's own trailing edge instead — half in, half out, vertically centered — is
 * the same pattern VS Code/Notion/Slack use for a collapsible sidebar: it reads
 * immediately as "a control for the sidebar itself," stays in one predictable spot
 * regardless of how many nav items or how much scrolling is above it, and doesn't
 * compete for space in an already-narrow expanded width (200px) that this app's
 * default *vertical* window makes even more precious than before. */
export function CollapseToggle({
  collapsed,
  onClick,
}: {
  readonly collapsed: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <Tooltip title={label} placement="right">
      <IconButton
        onClick={onClick}
        aria-label={label}
        size="small"
        sx={{
          position: "absolute",
          top: "50%",
          right: -12,
          transform: "translateY(-50%)",
          width: 24,
          height: 24,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          boxShadow: 2,
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
