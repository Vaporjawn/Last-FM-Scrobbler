import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaybackStatusChip } from "../../src/renderer/src/components/shared/PlaybackStatusChip.js";

describe("PlaybackStatusChip", () => {
  it("shows the now-playing label when nowPlaying is true", () => {
    render(
      <PlaybackStatusChip nowPlaying={true} timestamp={1_700_000_000} nowPlayingLabel="Now Playing" />,
    );

    expect(screen.getByText("Now Playing")).toBeInTheDocument();
  });

  it("shows the formatted timestamp as a chip when not playing", () => {
    render(<PlaybackStatusChip nowPlaying={false} timestamp={1_700_000_000} nowPlayingLabel="Now Playing" />);

    expect(screen.getByText(new Date(1_700_000_000 * 1000).toLocaleString())).toBeInTheDocument();
  });

  it("renders nothing when not playing and no timestamp is given", () => {
    const { container } = render(
      <PlaybackStatusChip nowPlaying={false} timestamp={undefined} nowPlayingLabel="Now Playing" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
