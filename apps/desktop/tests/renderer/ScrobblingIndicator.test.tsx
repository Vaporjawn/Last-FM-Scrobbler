import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrobblingIndicator } from "../../src/renderer/src/components/ScrobblingIndicator.js";

describe("ScrobblingIndicator", () => {
  it("renders three bars, hidden from assistive tech (purely decorative)", () => {
    const { container } = render(<ScrobblingIndicator />);

    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root?.children).toHaveLength(3);
  });

  it("accepts a custom size without changing the bar count", () => {
    const { container } = render(<ScrobblingIndicator size={20} />);

    expect(container.firstElementChild?.children).toHaveLength(3);
  });

  it("forwards a className to its root element, so MUI's Chip can attach its icon spacing", () => {
    // Chip clones whatever it's given as `icon` and injects its own `MuiChip-icon`
    // class via `cloneElement(icon, { className: ... })` — a component only picks
    // that up if it actually forwards `className` onto its root. Dropping it (as this
    // component once did) left the indicator flush against the chip's edge with no
    // spacing from the label, in every chip that uses it (FriendListItem,
    // ScrobbleListItem, NowPlayingPage). Asserting the forwarding directly here, not
    // just via a real Chip's specific spacing values, keeps this test stable even if
    // MUI's own chip-icon CSS changes.
    const { container } = render(<ScrobblingIndicator className="injected-test-class" />);

    expect(container.firstElementChild).toHaveClass("injected-test-class");
  });
});
