import { useEffect, useRef, useState, type JSX } from "react";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import { isPortraitAspectRatio } from "../../../shared/is-portrait-aspect-ratio.js";
import { useSettings } from "../contexts/settings-context.js";
import { NetworkStatusChip } from "./NetworkStatusChip.js";
import { NAV_ITEMS, SETTINGS_ITEM, type ViewId } from "./nav-items.js";
import { SidebarHeader } from "./SidebarHeader.js";
import { NavButton } from "./NavButton.js";
import { ReportBugButton } from "./ReportBugButton.js";
import { CollapseToggle } from "./CollapseToggle.js";

const WIDTH_EXPANDED = 200;
const WIDTH_COLLAPSED = 64;

/**
 * Props for `NavigationSidebar`: which view is currently shown, the callback invoked when
 * a destination is picked, and an optional bug-report trigger.
 */
export interface NavigationSidebarProps {
  readonly activeView: ViewId;
  readonly onSelectView: (view: ViewId) => void;
  /** Omitted entirely in contexts that don't wire bug reporting — no button is
   * rendered in that case, rather than a button that does nothing. */
  readonly onReportBug?: () => void;
}
/** The app's persistent left-hand navigation chrome: an icon+label list of every
 * `ViewId` destination, a pinned Settings/Report-a-Bug section beneath a divider, and a
 * floating collapse toggle (see `CollapseToggle`) that shrinks the whole drawer to
 * icon-only. Starts (and re-collapses on switching into) *collapsed* whenever the
 * window's own aspect ratio is a portrait one (`"9:16"`/`"9:14"`, this app's own
 * default — see `isPortraitAspectRatio`) — the 200px expanded width that's a minor
 * convenience in a wide landscape window is a genuinely large fraction of this app's
 * narrow portrait width (680px at minimum), so defaulting to icon-only there gives
 * real content the room a vertical window makes scarce. */
export function NavigationSidebar({
  activeView,
  onSelectView,
  onReportBug,
}: NavigationSidebarProps): JSX.Element {
  const { settings, loading } = useSettings();
  const [collapsed, setCollapsed] = useState(() => isPortraitAspectRatio(settings.aspectRatio));
  const wasPortraitRef = useRef(isPortraitAspectRatio(settings.aspectRatio));
  // `useSettingsState` always starts a render with `DEFAULT_APP_SETTINGS` (portrait,
  // this app's own default) synchronously, before the real persisted value resolves
  // asynchronously — see that hook's own `loading` doc comment. Without accounting for
  // that, a real *landscape* setting would still leave this sidebar collapsed from
  // that synchronous default, since the effect below would only ever see
  // `settings.aspectRatio` change *into* portrait, never notice it resolving *out* of
  // the temporary default. `hasSyncedInitialLoadRef` marks the one moment that
  // shouldn't count as a "live" change at all: the instant `loading` first turns
  // `false`, `collapsed` is synced directly to whatever the real settings say, in
  // *either* direction, since nothing about the initial load finishing is a user
  // toggling anything.
  const hasSyncedInitialLoadRef = useRef(false);
  useEffect(() => {
    const isPortrait = isPortraitAspectRatio(settings.aspectRatio);
    if (!loading && !hasSyncedInitialLoadRef.current) {
      hasSyncedInitialLoadRef.current = true;
      setCollapsed(isPortrait);
    } else if (hasSyncedInitialLoadRef.current && isPortrait && !wasPortraitRef.current) {
      // A genuine *live* change to a portrait ratio thereafter (e.g. picked in
      // Settings while this app is already running) re-collapses the sidebar too —
      // but only in this direction. Switching back to landscape doesn't force it open
      // again, which would override a sidebar state the user may have set
      // deliberately in the meantime.
      setCollapsed(true);
    }
    wasPortraitRef.current = isPortrait;
  }, [settings.aspectRatio, loading]);
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
          // `visible`, not `hidden`: the toggle below intentionally sits half outside
          // this paper's own right edge, and `overflow: hidden` would clip it. Nothing
          // here actually overflows otherwise — collapsed labels are omitted outright
          // (see SidebarButton/SidebarHeader), not just visually hidden past an edge —
          // so there's no longer anything for `hidden` to have been protecting against.
          overflow: "visible",
          position: "relative",
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
        {onReportBug ? <ReportBugButton collapsed={collapsed} onClick={onReportBug} /> : null}
      </List>
      <NetworkStatusChip collapsed={collapsed} />
      <CollapseToggle
        collapsed={collapsed}
        onClick={() => {
          setCollapsed((previous) => !previous);
        }}
      />
    </Drawer>
  );
}
