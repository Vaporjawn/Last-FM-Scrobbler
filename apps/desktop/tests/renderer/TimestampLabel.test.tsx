import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/renderer/src/hooks/use-shrink-to-fit-index.js", () => ({
  useShrinkToFitIndex: () => ({ containerRef: { current: null }, index: 99 }),
}));

import { TimestampLabel } from "../../src/renderer/src/components/shared/TimestampLabel.js";
import { formatTimestampCandidates } from "../../src/renderer/src/components/shared/format-timestamp-candidates.js";

describe("TimestampLabel", () => {
  it("falls back to the first (widest) candidate if the shrink index is ever out of range", () => {
    render(<TimestampLabel timestamp={1_700_000_000} />);

    expect(screen.getByText(formatTimestampCandidates(1_700_000_000)[0])).toBeInTheDocument();
  });
});
