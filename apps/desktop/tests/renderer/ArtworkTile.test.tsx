import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArtworkTile } from "../../src/renderer/src/components/shared/ArtworkTile.js";

describe("ArtworkTile", () => {
  it("renders a plain tile (no link) when no href is given", () => {
    render(
      <ArtworkTile
        imageUrl={undefined}
        title="In Rainbows"
        subtitle="Radiohead"
        fallback={<span>fallback</span>}
      />,
    );

    expect(screen.getByText("In Rainbows")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("wraps the tile in an accessibly named link when an href is given", () => {
    render(
      <ArtworkTile
        imageUrl={undefined}
        title="In Rainbows"
        subtitle="Radiohead"
        fallback={<span>fallback</span>}
        href="https://www.last.fm/music/Radiohead"
        ariaLabel="View In Rainbows on Last.fm"
      />,
    );

    expect(screen.getByRole("link", { name: "View In Rainbows on Last.fm" })).toHaveAttribute(
      "href",
      "https://www.last.fm/music/Radiohead",
    );
  });
});
