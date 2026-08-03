import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RefreshButton } from "../../src/renderer/src/components/shared/RefreshButton.js";

describe("RefreshButton", () => {
  it("calls onRefresh when clicked", () => {
    const onRefresh = vi.fn();
    render(<RefreshButton onRefresh={onRefresh} refreshing={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("is disabled while refreshing", () => {
    render(<RefreshButton onRefresh={vi.fn()} refreshing />);

    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });

  it("is not disabled while idle", () => {
    render(<RefreshButton onRefresh={vi.fn()} refreshing={false} />);

    expect(screen.getByRole("button", { name: "Refresh" })).not.toBeDisabled();
  });

  it("uses a custom label for both the accessible name and the tooltip", () => {
    render(<RefreshButton onRefresh={vi.fn()} refreshing={false} label="Refresh friends" />);

    expect(screen.getByRole("button", { name: "Refresh friends" })).toBeInTheDocument();
  });
});
