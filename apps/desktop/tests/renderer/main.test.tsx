import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const renderRoot = vi.hoisted(() => vi.fn());

vi.mock("react-dom/client", () => ({ createRoot: () => ({ render: renderRoot }) }));
vi.mock("../../src/renderer/src/App.js", () => ({ App: () => <div>app</div> }));
vi.mock("../../src/renderer/src/TrayPopover.js", () => ({ TrayPopover: () => <div>popover</div> }));
vi.mock("../../src/renderer/src/components/ErrorBoundary.js", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => (
    <div data-testid="boundary">{children}</div>
  ),
}));
vi.mock("../../src/renderer/src/contexts/SettingsProvider.js", () => ({
  SettingsProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="settings">{children}</div>
  ),
}));

async function loadEntry(): Promise<void> {
  vi.resetModules();
  renderRoot.mockClear();
  await import("../../src/renderer/src/main.js");
}

describe("renderer entry point", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    window.location.hash = "";
  });

  afterEach(() => {
    window.location.hash = "";
  });

  it("renders the app inside the error boundary and settings provider", async () => {
    await loadEntry();

    render(renderRoot.mock.calls[0]?.[0] as ReactNode);

    expect(screen.getByTestId("boundary")).toContainElement(screen.getByTestId("settings"));
    expect(screen.getByText("app")).toBeInTheDocument();
  });

  it("renders the tray popover, without the settings provider, for the #tray-popover hash", async () => {
    window.location.hash = "#tray-popover";

    await loadEntry();
    render(renderRoot.mock.calls[0]?.[0] as ReactNode);

    expect(screen.getByText("popover")).toBeInTheDocument();
    expect(screen.queryByTestId("settings")).not.toBeInTheDocument();
  });

  it("fails loudly when the page has no #root element", async () => {
    document.body.innerHTML = "";

    await expect(loadEntry()).rejects.toThrow("Root element #root not found");
  });
});
