import type { JSX } from "react";
import LibraryMusicIcon from "@mui/icons-material/LibraryMusic";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SettingsIcon from "@mui/icons-material/Settings";

/** Every top-level destination `NavigationSidebar` can route to. Deliberately excludes
 * `ScrobbleDetailPage` — a detail view isn't a sidebar destination, it's a drill-down
 * that always returns to whichever page opened it (see `page-props.ts`'s
 * `onSelectScrobble` docstring), so `App.tsx` holds "which track" as separate state
 * rather than folding it into this union. */
export type ViewId = "now-playing" | "scrobbles" | "profile" | "friends" | "settings";

export interface NavItem {
  readonly id: ViewId;
  readonly label: string;
  readonly icon: JSX.Element;
}

/** The sidebar's main nav list, in display order. `SETTINGS_ITEM` below is deliberately
 * excluded — it's pinned to its own section beneath a divider (see
 * `NavigationSidebar`), not part of this scrollable list. */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "now-playing", label: "Now Playing", icon: <PlayCircleIcon /> },
  { id: "scrobbles", label: "Scrobbles", icon: <LibraryMusicIcon /> },
  { id: "profile", label: "Profile", icon: <PersonIcon /> },
  { id: "friends", label: "Friends", icon: <PeopleIcon /> },
];

export const SETTINGS_ITEM: NavItem = {
  id: "settings",
  label: "Settings",
  icon: <SettingsIcon />,
};
