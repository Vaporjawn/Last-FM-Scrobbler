import { useState, type JSX } from "react";
import BugReportIcon from "@mui/icons-material/BugReport";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SettingsIcon from "@mui/icons-material/Settings";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";

export type ViewId = "now-playing" | "scrobbles" | "profile" | "friends" | "preferences";

interface NavItem {
  readonly id: ViewId;
  readonly label: string;
  readonly icon: JSX.Element;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: "now-playing", label: "Now Playing", icon: <PlayCircleIcon /> },
  { id: "scrobbles", label: "Scrobbles", icon: <LibraryMusicIcon /> },
  { id: "profile", label: "Profile", icon: <PersonIcon /> },
  { id: "friends", label: "Friends", icon: <PeopleIcon /> },
];

const PREFERENCES_ITEM: NavItem = {
  id: "preferences",
  label: "Preferences",
  icon: <SettingsIcon />,
};

const WIDTH_EXPANDED = 200;
const WIDTH_COLLAPSED = 64;

export interface NavigationSidebarProps {
  readonly activeView: ViewId;
  readonly onSelectView: (view: ViewId) => void;
  /** Omitted entirely in contexts that don't wire bug reporting — no button is
   * rendered in that case, rather than a button that does nothing. */
  readonly onReportBug?: () => void;
}

function SidebarButton({
  label,
  icon,
  selected,
  collapsed,
  onClick,
}: {
  readonly label: string;
  readonly icon: JSX.Element;
  readonly selected: boolean;
  readonly collapsed: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  const button = (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      aria-label={label}
      sx={{ justifyContent: collapsed ? "center" : "flex-start", px: collapsed ? 2 : 3 }}
    >
      <ListItemIcon sx={{ minWidth: collapsed ? 0 : undefined, justifyContent: "center" }}>
        {icon}
      </ListItemIcon>
      {collapsed ? null : <ListItemText primary={label} sx={{ ml: 1 }} />}
    </ListItemButton>
  );

  // Tooltips only add value once the label itself is hidden — showing both the visible
  // label and a tooltip repeating it is just noise.
  return collapsed ? (
    <Tooltip title={label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function NavButton({
  item,
  selected,
  collapsed,
  onClick,
}: {
  readonly item: NavItem;
  readonly selected: boolean;
  readonly collapsed: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <SidebarButton
      label={item.label}
      icon={item.icon}
      selected={selected}
      collapsed={collapsed}
      onClick={onClick}
    />
  );
}

function ReportBugButton({
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

export function NavigationSidebar({
  activeView,
  onSelectView,
  onReportBug,
}: NavigationSidebarProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const width = collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: (theme) => theme.transitions.create("width"),
        "& .MuiDrawer-paper": {
          width,
          boxSizing: "border-box",
          overflowX: "hidden",
          transition: (theme) => theme.transitions.create("width"),
        },
      }}
    >
      <List sx={{ flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            selected={activeView === item.id}
            collapsed={collapsed}
            onClick={() => {
              onSelectView(item.id);
            }}
          />
        ))}
      </List>
      <Divider />
      <List>
        <NavButton
          item={PREFERENCES_ITEM}
          selected={activeView === PREFERENCES_ITEM.id}
          collapsed={collapsed}
          onClick={() => {
            onSelectView(PREFERENCES_ITEM.id);
          }}
        />
        {onReportBug ? (
          <ReportBugButton collapsed={collapsed} onClick={onReportBug} />
        ) : null}
        <ListItemButton
          onClick={() => {
            setCollapsed((previous) => !previous);
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          sx={{ justifyContent: collapsed ? "center" : "flex-start", px: collapsed ? 2 : 3 }}
        >
          <ListItemIcon sx={{ minWidth: collapsed ? 0 : undefined, justifyContent: "center" }}>
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </ListItemIcon>
          {collapsed ? null : <ListItemText primary="Collapse" sx={{ ml: 1 }} />}
        </ListItemButton>
      </List>
    </Drawer>
  );
}
