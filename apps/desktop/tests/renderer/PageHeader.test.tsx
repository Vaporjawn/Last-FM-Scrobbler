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
});
