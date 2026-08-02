import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BugReportApi } from "../../src/shared/bug-report-api.js";
import { BugReportDialog } from "../../src/renderer/src/components/BugReportDialog.js";

function installFakeBugReportApi(overrides: Partial<BugReportApi> = {}): void {
  const api: BugReportApi = {
    isConfigured: vi.fn().mockResolvedValue(true),
    submit: vi.fn().mockResolvedValue({ issueUrl: "https://github.com/x/y/issues/1" }),
    ...overrides,
  };
  Object.defineProperty(window, "bugReport", { value: api, configurable: true });
}

describe("BugReportDialog", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "bugReport");
  });

  it("renders nothing when closed", () => {
    installFakeBugReportApi();

    render(<BugReportDialog open={false} onClose={() => undefined} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows 'not configured' rather than an indefinite spinner when window.bugReport is entirely absent", async () => {
    // No installFakeBugReportApi() call — simulates a preload script that failed to
    // load (see docs/modules/desktop.md), where every window.* API is just missing.
    render(<BugReportDialog open onClose={() => undefined} />);

    expect(await screen.findByText(/not configured/i)).toBeInTheDocument();
  });

  it("shows a 'not configured' message when the app has no relay configured", async () => {
    installFakeBugReportApi({ isConfigured: vi.fn().mockResolvedValue(false) });

    render(<BugReportDialog open onClose={() => undefined} />);

    expect(await screen.findByText(/not configured/i)).toBeInTheDocument();
  });

  it("submits the entered title and description", async () => {
    const submit = vi.fn().mockResolvedValue({ issueUrl: "https://github.com/x/y/issues/1" });
    installFakeBugReportApi({ submit });

    render(<BugReportDialog open onClose={() => undefined} />);
    await screen.findByLabelText(/title/i);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Crash on launch" } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "It crashes every time." },
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    });

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith("Crash on launch", "It crashes every time.");
    });
  });

  it("shows the created issue URL after a successful submission", async () => {
    installFakeBugReportApi({
      submit: vi.fn().mockResolvedValue({ issueUrl: "https://github.com/x/y/issues/7" }),
    });

    render(<BugReportDialog open onClose={() => undefined} />);
    await screen.findByLabelText(/title/i);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Title" } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Description" } });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    });

    expect(await screen.findByText("https://github.com/x/y/issues/7")).toBeInTheDocument();
  });

  it("shows an error message when submission fails", async () => {
    installFakeBugReportApi({ submit: vi.fn().mockRejectedValue(new Error("relay is down")) });

    render(<BugReportDialog open onClose={() => undefined} />);
    await screen.findByLabelText(/title/i);
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Title" } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Description" } });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    });

    expect(await screen.findByText("relay is down")).toBeInTheDocument();
  });

  it("disables submit until both fields have content", async () => {
    installFakeBugReportApi();

    render(<BugReportDialog open onClose={() => undefined} />);
    await screen.findByLabelText(/title/i);

    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Title" } });
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Description" } });
    expect(screen.getByRole("button", { name: /submit/i })).toBeEnabled();
  });
});
