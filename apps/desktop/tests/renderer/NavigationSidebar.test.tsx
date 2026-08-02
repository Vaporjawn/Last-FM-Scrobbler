import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationSidebar } from "../../src/renderer/src/components/NavigationSidebar.js";

describe("NavigationSidebar", () => {
  it("renders all five navigation destinations", () => {
    render(<NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />);

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

  it("hides labels but keeps every destination reachable and accessible once collapsed", () => {
    render(<NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));

    expect(screen.queryByText("Now Playing")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Now Playing")).toBeInTheDocument();
    expect(screen.getByLabelText("Scrobbles")).toBeInTheDocument();
    expect(screen.getByLabelText("Profile")).toBeInTheDocument();
    expect(screen.getByLabelText("Friends")).toBeInTheDocument();
    expect(screen.getByLabelText("Preferences")).toBeInTheDocument();
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  it("still calls onSelectView by destination while collapsed", () => {
    const onSelectView = vi.fn();
    render(<NavigationSidebar activeView="now-playing" onSelectView={onSelectView} />);

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));
    fireEvent.click(screen.getByLabelText("Friends"));

    expect(onSelectView).toHaveBeenCalledWith("friends");
  });

  it("restores labels when expanded again", () => {
    render(<NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));
    fireEvent.click(screen.getByLabelText("Expand sidebar"));

    expect(screen.getByText("Now Playing")).toBeInTheDocument();
    expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
  });
});
