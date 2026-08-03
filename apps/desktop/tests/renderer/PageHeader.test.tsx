import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "../../src/renderer/src/components/PageHeader.js";

describe("PageHeader", () => {
  it("renders the title", () => {
    render(<PageHeader title="Scrobbles" />);

    expect(screen.getByRole("heading", { name: "Scrobbles" })).toBeInTheDocument();
  });

  it("renders an optional subtitle below the title", () => {
    render(<PageHeader title="Scrobbles" subtitle="Showing recent activity for alice" />);

    expect(screen.getByText("Showing recent activity for alice")).toBeInTheDocument();
  });

  it("renders no subtitle text at all when one isn't given", () => {
    const { container } = render(<PageHeader title="Scrobbles" />);

    // Only the title's own text node should be present — nothing else rendered.
    expect(container.textContent).toBe("Scrobbles");
  });

  it("renders the subtitle on the same line as the title when inlineSubtitle is set", () => {
    render(<PageHeader title="Friends" subtitle="50 friends" inlineSubtitle />);

    const heading = screen.getByRole("heading", { name: "Friends" });
    const subtitle = screen.getByText("50 friends");
    // Siblings under the same row container, not title-then-subtitle stacked in
    // separate blocks — the concrete signal for that here is that they share a
    // parent element rather than the subtitle being nested under/after a
    // title-only wrapper.
    expect(heading.parentElement).toBe(subtitle.parentElement);
  });

  it("ignores inlineSubtitle when there's no subtitle to show", () => {
    const { container } = render(<PageHeader title="Friends" inlineSubtitle />);

    expect(container.textContent).toBe("Friends");
  });
});
