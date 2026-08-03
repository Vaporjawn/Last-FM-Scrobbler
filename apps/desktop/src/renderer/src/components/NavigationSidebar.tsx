import { useEffect, useRef, useState, type JSX } from "react";
import BugReportIcon from "@mui/icons-material/BugReport";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { isPortraitAspectRatio } from "../../../shared/settings-api.js";
import { useSettings } from "../contexts/settings-context.js";
import { NAV_ITEMS, SETTINGS_ITEM, type NavItem, type ViewId } from "./nav-items.js";

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

/** The collapse toggle used to be its own full-width row in the bottom `List`,
 * visually indistinguishable from a real navigation destination (same icon+label
 * treatment as Settings/Report a Bug) even though it isn't one. Floating it on the
 * sidebar's own trailing edge instead — half in, half out, vertically centered — is
 * the same pattern VS Code/Notion/Slack use for a collapsible sidebar: it reads
 * immediately as "a control for the sidebar itself," stays in one predictable spot
 * regardless of how many nav items or how much scrolling is above it, and doesn't
 * compete for space in an already-narrow expanded width (200px) that this app's
 * default *vertical* window makes even more precious than before. */
function CollapseToggle({
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
      <CollapseToggle
        collapsed={collapsed}
        onClick={() => {
          setCollapsed((previous) => !previous);
        }}
      />
    </Drawer>
  );
}
