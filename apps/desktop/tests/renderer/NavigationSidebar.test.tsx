import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationSidebar } from "../../src/renderer/src/components/NavigationSidebar.js";

describe("NavigationSidebar", () => {
  it("renders all five navigation destinations", () => {
    render(<NavigationSidebar activeView="now-playing" onSelectView={() => {}} />);

    expect(screen.getByText("Now Playing")).toBeInTheDocument();
    expect(screen.getByText("Scrobbles")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Friends")).toBeInTheDocument();
    expect(screen.getByText("Preferences")).toBeInTheDocument();
  });

  it("calls onSelectView with the clicked destination", () => {
    const onSelectView = vi.fn();
    render(<NavigationSidebar activeView="now-playing" onSelectView={onSelectView} />);

    fireEvent.click(screen.getByText("Friends"));

    expect(onSelectView).toHaveBeenCalledWith("friends");
  });
});
