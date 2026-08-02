import type { JSX } from "react";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SettingsIcon from "@mui/icons-material/Settings";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";

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

export interface NavigationSidebarProps {
  readonly activeView: ViewId;
  readonly onSelectView: (view: ViewId) => void;
}

export function NavigationSidebar({
  activeView,
  onSelectView,
}: NavigationSidebarProps): JSX.Element {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 200,
        flexShrink: 0,
        "& .MuiDrawer-paper": { width: 200, boxSizing: "border-box" },
      }}
    >
      <List sx={{ flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => (
          <ListItemButton
            key={item.id}
            selected={activeView === item.id}
            onClick={() => {
              onSelectView(item.id);
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <List>
        <ListItemButton
          selected={activeView === PREFERENCES_ITEM.id}
          onClick={() => {
            onSelectView(PREFERENCES_ITEM.id);
          }}
        >
          <ListItemIcon>{PREFERENCES_ITEM.icon}</ListItemIcon>
          <ListItemText primary={PREFERENCES_ITEM.label} />
        </ListItemButton>
      </List>
    </Drawer>
  );
}
