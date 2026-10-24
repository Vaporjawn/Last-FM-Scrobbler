import { type JSX } from "react";
import { type NavItem } from "./nav-items.js";
import { SidebarButton } from "./SidebarButton.js";

/**
 * One destination button in the navigation sidebar: adapts a `NavItem` (label and icon)
 * onto the generic `SidebarButton`, which owns the expanded and icon-only collapsed
 * rendering.
 */
export function NavButton({
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
