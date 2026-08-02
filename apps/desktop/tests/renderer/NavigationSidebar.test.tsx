import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationSidebar } from "../../src/renderer/src/components/NavigationSidebar.js";

describe("NavigationSidebar", () => {
  it("shows the app icon and wordmark when expanded", () => {
    render(<NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />);

    expect(screen.getByText("Last.fm")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Last.fm Scrobbler" })).toBeInTheDocument();
  });

  it("shows only the app icon, not the wordmark, once collapsed", () => {
    render(<NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));

    expect(screen.queryByText("Last.fm")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Last.fm Scrobbler" })).toBeInTheDocument();
  });

  it("renders all five navigation destinations", () => {
    render(<NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />);

    expect(screen.getByText("Now Playing")).toBeInTheDocument();
    expect(screen.getByText("Scrobbles")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Friends")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
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
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  it("still calls onSelectView by destination while collapsed", () => {
    const onSelectView = vi.fn();
    render(<NavigationSidebar activeView="now-playing" onSelectView={onSelectView} />);

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));
    fireEvent.click(screen.getByLabelText("Friends"));

    expect(onSelectView).toHaveBeenCalledWith("friends");
  });

  it("does not render a 'Report a Bug' button when onReportBug is omitted", () => {
    render(<NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />);

    expect(screen.queryByText("Report a Bug")).not.toBeInTheDocument();
  });

  it("calls onReportBug when the 'Report a Bug' button is clicked", () => {
    const onReportBug = vi.fn();
    render(
      <NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} onReportBug={onReportBug} />,
    );

    fireEvent.click(screen.getByText("Report a Bug"));

    expect(onReportBug).toHaveBeenCalled();
  });

  it("restores labels when expanded again", () => {
    render(<NavigationSidebar activeView="now-playing" onSelectView={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Collapse sidebar"));
    fireEvent.click(screen.getByLabelText("Expand sidebar"));

    expect(screen.getByText("Now Playing")).toBeInTheDocument();
    expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
  });
});
