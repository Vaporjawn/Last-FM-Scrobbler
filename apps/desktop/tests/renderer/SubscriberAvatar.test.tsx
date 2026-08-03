import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubscriberAvatar } from "../../src/renderer/src/components/shared/SubscriberAvatar.js";

describe("SubscriberAvatar", () => {
  it("shows the fallback initial when no src is given", () => {
    render(
      <SubscriberAvatar
        src={undefined}
        alt="someuser"
        size={48}
        fallbackInitial="S"
        isSubscriber={false}
        bgcolor="action.selected"
      />,
    );

    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("shows the Last.fm Pro badge for a subscriber", () => {
    render(
      <SubscriberAvatar
        src={undefined}
        alt="someuser"
        size={48}
        fallbackInitial="S"
        isSubscriber={true}
        bgcolor="action.selected"
      />,
    );

    expect(screen.getByTitle("Last.fm Pro subscriber")).toBeInTheDocument();
  });

  it("doesn't render a badge at all for a non-subscriber", () => {
    render(
      <SubscriberAvatar
        src={undefined}
        alt="someuser"
        size={48}
        fallbackInitial="S"
        isSubscriber={false}
        bgcolor="action.selected"
      />,
    );

    expect(screen.queryByTitle("Last.fm Pro subscriber")).not.toBeInTheDocument();
  });
});
