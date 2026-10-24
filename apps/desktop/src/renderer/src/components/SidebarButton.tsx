import { type JSX } from "react";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";

/**
 * A single sidebar entry: an icon plus label on a `ListItemButton`. When `collapsed` the
 * visible label is dropped and shown as a right-hand tooltip instead (the button keeps an
 * `aria-label` either way), and the button is wrapped in a `ListItem` so the surrounding
 * `<ul>` only contains `<li>` children.
 */
export function SidebarButton({
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
  //
  // `ListItem disablePadding` wraps every button below - not just visual (MUI's own
  // documented pattern for a List containing ListItemButton), it's also a real
  // accessibility fix: a plain ListItemButton renders as a `<button>`, so a List of
  // bare ListItemButtons (the previous shape here) put `<button>` elements directly
  // inside the `<ul>` List renders, which axe-core's `list` rule correctly flags -
  // `<ul>`/`<ol>` may only directly contain `<li>` (`disablePadding` just removes the
  // padding List otherwise adds around each item, since ListItemButton already
  // supplies its own).
  return (
    <ListItem disablePadding>
      {collapsed ? (
        <Tooltip title={label} placement="right">
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </ListItem>
  );
}
