import { useState, type JSX } from "react";
import BugReportIcon from "@mui/icons-material/BugReport";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SettingsIcon from "@mui/icons-material/Settings";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

export type ViewId = "now-playing" | "scrobbles" | "profile" | "friends" | "settings";

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

const SETTINGS_ITEM: NavItem = {
  id: "settings",
  label: "Settings",
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

/** Purely presentational visual anchor for the app's persistent chrome — no props
 * beyond `collapsed`, no click behavior. `/favicon.png` (served from `public/`) is
 * byte-identical to `resources/app-icon.png` (verified via `shasum`) — the same mark
 * used for the dock/window icon — so this reuses it directly rather than duplicating
 * the asset under a second name. */
function SidebarHeader({ collapsed }: { readonly collapsed: boolean }): JSX.Element {
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
      <SidebarHeader collapsed={collapsed} />
      <Divider />
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
          item={SETTINGS_ITEM}
          selected={activeView === SETTINGS_ITEM.id}
          collapsed={collapsed}
          onClick={() => {
            onSelectView(SETTINGS_ITEM.id);
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
