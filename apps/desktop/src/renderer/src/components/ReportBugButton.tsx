import { type JSX } from "react";
import BugReportIcon from "@mui/icons-material/BugReport";
import { SidebarButton } from "./SidebarButton.js";

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
