import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../../src/renderer/src/components/shared/ConfirmDialog.js";

describe("ConfirmDialog", () => {
  it("renders nothing visible when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Reset to defaults?"
        description="This can't be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText("Reset to defaults?")).not.toBeInTheDocument();
  });

  it("shows the title and description when open", () => {
    render(
      <ConfirmDialog
        open
        title="Reset to defaults?"
        description="This can't be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Reset to defaults?")).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
  });

  it("defaults the confirm button label to 'Confirm'", () => {
    render(
      <ConfirmDialog open title="Reset?" description="..." onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("uses a custom confirmLabel when given", () => {
    render(
      <ConfirmDialog
        open
        title="Reset?"
        description="..."
        confirmLabel="Reset to defaults"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Reset to defaults" })).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog open title="Reset?" description="..." onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Reset?" description="..." onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables both buttons and shows a busy confirm label while confirming", () => {
    render(
      <ConfirmDialog
        open
        title="Reset?"
        description="..."
        confirming
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
  });
});
