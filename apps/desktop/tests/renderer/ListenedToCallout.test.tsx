import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListenedToCallout } from "../../src/renderer/src/components/shared/ListenedToCallout.js";

describe("ListenedToCallout", () => {
  it("uses the singular for a single play", () => {
    const { container } = render(
      <ListenedToCallout
        artistName="Radiohead"
        trackName="Nude"
        artistPlayCount={1}
        trackPlayCount={undefined}
      />,
    );

    expect(container).toHaveTextContent("You've listened to Radiohead 1 time");
    expect(container).not.toHaveTextContent("1 times");
  });

  it("uses the plural and joins both counts when each is positive", () => {
    const { container } = render(
      <ListenedToCallout
        artistName="Radiohead"
        trackName="Nude"
        artistPlayCount={1200}
        trackPlayCount={3}
      />,
    );

    expect(container).toHaveTextContent("Radiohead 1,200 times and");
    expect(container).toHaveTextContent("Nude 3 times");
  });

  it("renders nothing when neither count is positive", () => {
    const { container } = render(
      <ListenedToCallout
        artistName="Radiohead"
        trackName="Nude"
        artistPlayCount={0}
        trackPlayCount={undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/listened/)).not.toBeInTheDocument();
  });
});
