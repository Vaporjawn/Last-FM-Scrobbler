import type { JSX } from "react";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import SyncIcon from "@mui/icons-material/Sync";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { useNetworkStatus } from "../hooks/use-network-status.js";

export interface NetworkStatusChipProps {
  /** Icon-only when true (matches `SidebarButton`/`NavButton`'s own `collapsed`
   * convention) — an accessible label is still provided via `Chip`'s own `aria-label`
   * fallback (an icon-only MUI `Chip` renders no visible text to derive a name from
   * otherwise). */
  readonly collapsed: boolean;
}

/**
 * A small persistent connectivity indicator for the sidebar — renders nothing when
 * `online` is `null` (no connected service to test against — see `NetworkStatus`'s
 * docstring) and nothing is pending, and nothing when fully synced (online, zero
 * pending), so it stays out of the way except when there's something worth showing.
 */
export function NetworkStatusChip({ collapsed }: NetworkStatusChipProps): JSX.Element | null {
  const { status } = useNetworkStatus();

  if (status.online !== false && status.pendingCount === 0) {
    return null;
  }

  const label =
    status.online === false
      ? status.pendingCount > 0
        ? `Offline, ${status.pendingCount} pending`
        : "Offline"
      : `${status.pendingCount} pending`;
  const icon = status.online === false ? <CloudOffIcon /> : <SyncIcon />;
  const color = status.online === false ? "warning" : "info";

  const chip = (
    <Chip
      size="small"
      color={color}
      icon={icon}
      label={collapsed ? undefined : label}
      aria-label={collapsed ? label : undefined}
      sx={{ mx: collapsed ? "auto" : 2, mb: 1, display: "flex" }}
    />
  );

  return collapsed ? <Tooltip title={label}>{chip}</Tooltip> : chip;
}
