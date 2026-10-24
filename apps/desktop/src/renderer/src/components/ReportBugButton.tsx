import { type JSX } from "react";
import BugReportIcon from "@mui/icons-material/BugReport";
import { SidebarButton } from "./SidebarButton.js";

/**
 * The sidebar's "Report a Bug" entry: a fixed label and bug icon on a `SidebarButton`
 * that is never shown as selected, because it opens a dialog rather than navigating to a view.
 */
export function ReportBugButton({
  collapsed,
  onClick,
}: {
  readonly collapsed: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <SidebarButton
      label="Report a Bug"
      icon={<BugReportIcon />}
      selected={false}
      collapsed={collapsed}
      onClick={onClick}
    />
  );
}
