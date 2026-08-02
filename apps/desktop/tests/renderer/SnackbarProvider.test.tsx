import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SnackbarProvider } from "../../src/renderer/src/contexts/SnackbarProvider.js";
import { useSnackbar } from "../../src/renderer/src/contexts/snackbar-context.js";

function NotifyButton({
  message,
  severity,
  actionLabel,
  onAction,
}: {
  readonly message: string;
  readonly severity?: "success" | "error" | "info" | "warning";
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}) {
  const { notify } = useSnackbar();
  return (
    <button
      onClick={() =>
        { notify({
          message,
          ...(severity ? { severity } : {}),
          ...(actionLabel && onAction ? { action: { label: actionLabel, onClick: onAction } } : {}),
        }); }
      }
    >
      Fire: {message}
    </button>
  );
}

describe("SnackbarProvider", () => {
  it("renders children", () => {
    render(
      <SnackbarProvider>
        <div>content</div>
      </SnackbarProvider>,
    );

    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("shows a queued message when notify() is called", async () => {
    render(
      <SnackbarProvider>
        <NotifyButton message="Loved 'Weights'" severity="success" />
      </SnackbarProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /fire: loved/i }));

    expect(await screen.findByText("Loved 'Weights'")).toBeInTheDocument();
  });

  it("shows the error severity styling for error notifications", async () => {
    render(
      <SnackbarProvider>
        <NotifyButton message="Something broke" severity="error" />
      </SnackbarProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /fire: something broke/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveClass("MuiAlert-colorError");
    expect(alert).toHaveClass("MuiAlert-filled");
  });

  it("renders an action button and calls its onClick when clicked", async () => {
    let actionClicked = false;
    render(
      <SnackbarProvider>
        <NotifyButton
          message="Saved"
          actionLabel="Restart now"
          onAction={() => {
            actionClicked = true;
          }}
        />
      </SnackbarProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /fire: saved/i }));
    const actionButton = await screen.findByRole("button", { name: /restart now/i });
    act(() => {
      fireEvent.click(actionButton);
    });

    expect(actionClicked).toBe(true);
  });

  it("queues a second message behind the first rather than dropping or overlapping it", async () => {
    function TwoMessages() {
      const { notify } = useSnackbar();
      return (
        <button
          onClick={() => {
            notify({ message: "First message" });
            notify({ message: "Second message" });
          }}
        >
          Fire both
        </button>
      );
    }

    render(
      <SnackbarProvider>
        <TwoMessages />
      </SnackbarProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /fire both/i }));

    expect(await screen.findByText("First message")).toBeInTheDocument();
    expect(screen.queryByText("Second message")).not.toBeInTheDocument();

    // Dismiss the first via the Alert's own close button.
    const closeButton = screen.getByRole("button", { name: /close/i });
    act(() => {
      fireEvent.click(closeButton);
    });

    await waitFor(
      () => {
        expect(screen.getByText("Second message")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.queryByText("First message")).not.toBeInTheDocument();
  });

  it("useSnackbar's notify is a harmless no-op outside a SnackbarProvider", () => {
    function StandaloneButton() {
      const { notify } = useSnackbar();
      return <button onClick={() => { notify({ message: "ignored" }); }}>Fire</button>;
    }

    render(<StandaloneButton />);

    expect(() => {
      fireEvent.click(screen.getByRole("button", { name: /fire/i }));
    }).not.toThrow();
  });
});
