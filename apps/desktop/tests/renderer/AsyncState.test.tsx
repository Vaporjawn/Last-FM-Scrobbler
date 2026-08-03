import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AsyncState } from "../../src/renderer/src/components/AsyncState.js";

describe("AsyncState", () => {
  describe("loading", () => {
    it("renders a centered spinner with a live region for screen readers", () => {
      render(<AsyncState kind="loading" />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAccessibleName("Loading…");
    });

    it("uses a caller-supplied label when given", () => {
      render(<AsyncState kind="loading" label="Loading scrobbles…" />);

      expect(screen.getByRole("progressbar")).toHaveAccessibleName("Loading scrobbles…");
    });

    it("renders the spinner when variant is explicitly \"spinner\"", () => {
      render(<AsyncState kind="loading" variant="spinner" />);

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    describe("list variant", () => {
      it("renders 5 row-shaped skeletons (avatar + two text lines) by default", () => {
        const { container } = render(<AsyncState kind="loading" variant="list" />);

        expect(screen.getByRole("status")).toHaveAccessibleName("Loading…");
        expect(container.querySelectorAll(".MuiSkeleton-circular")).toHaveLength(5);
        expect(container.querySelectorAll(".MuiSkeleton-text")).toHaveLength(10);
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      });

      it("renders a caller-supplied count instead", () => {
        const { container } = render(<AsyncState kind="loading" variant="list" count={3} />);

        expect(container.querySelectorAll(".MuiSkeleton-circular")).toHaveLength(3);
        expect(container.querySelectorAll(".MuiSkeleton-text")).toHaveLength(6);
      });

      it("uses a caller-supplied label for the live region", () => {
        render(<AsyncState kind="loading" variant="list" label="Loading friends…" />);

        expect(screen.getByRole("status")).toHaveAccessibleName("Loading friends…");
      });
    });

    describe("grid variant", () => {
      it("renders 5 square tile skeletons by default", () => {
        const { container } = render(<AsyncState kind="loading" variant="grid" />);

        expect(screen.getByRole("status")).toHaveAccessibleName("Loading…");
        expect(container.querySelectorAll(".MuiSkeleton-rounded")).toHaveLength(5);
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      });

      it("renders a caller-supplied count instead", () => {
        const { container } = render(<AsyncState kind="loading" variant="grid" count={8} />);

        expect(container.querySelectorAll(".MuiSkeleton-rounded")).toHaveLength(8);
      });
    });
  });

  describe("empty", () => {
    it("renders the caller's icon and message", () => {
      render(
        <AsyncState
          kind="empty"
          icon={<svg data-testid="empty-icon" />}
          message="No scrobbles yet."
        />,
      );

      expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
      expect(screen.getByText("No scrobbles yet.")).toBeInTheDocument();
    });
  });

  describe("error", () => {
    it("renders the message in an error Alert", () => {
      render(<AsyncState kind="error" message="Could not reach Last.fm." />);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("MuiAlert-colorError");
      expect(screen.getByText("Could not reach Last.fm.")).toBeInTheDocument();
    });

    it("does not show a retry action when onRetry is omitted", () => {
      render(<AsyncState kind="error" message="Could not reach Last.fm." />);

      expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    });

    it("shows a retry action and calls onRetry when clicked", () => {
      const onRetry = vi.fn();
      render(<AsyncState kind="error" message="Could not reach Last.fm." onRetry={onRetry} />);

      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      expect(onRetry).toHaveBeenCalledOnce();
    });
  });
});
