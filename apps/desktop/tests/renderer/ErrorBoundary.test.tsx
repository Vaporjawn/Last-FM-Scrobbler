import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../../src/renderer/src/components/ErrorBoundary.js";

/** Throws synchronously during render whenever `shouldThrow` is true — the standard
 * way to exercise an error boundary, since there's no other way to make a child
 * "just fail" from a test. */
function Bomb({ shouldThrow }: { readonly shouldThrow: boolean }): null {
  if (shouldThrow) {
    throw new Error("kaboom");
  }
  return null;
}

describe("ErrorBoundary", () => {
  // React logs its own verbose "An error occurred in the <Bomb> component" message
  // (with the full component stack) every time this boundary actually catches
  // something — intentional and expected in every test below that throws, but noisy
  // enough in test output to suppress rather than let it print as if it were an
  // unexpected failure.
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // A few tests below set this to exercise the light-mode fallback screen (see
    // `resolve-error-boundary-colors.ts`'s own tests for the actual color values) —
    // reset it so it can't leak into a later test in this file that doesn't care
    // about theming and expects the dark (no-attribute) default.
    delete document.documentElement.dataset.theme;
  });

  it("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("shows a fallback screen (not a blank page) when a descendant throws while rendering", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/reloading usually fixes it/i)).toBeInTheDocument();
  });

  it("includes the underlying error message for debugging", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText("kaboom")).toBeInTheDocument();
  });

  it("renders with the dark fallback colors when <html> has no data-theme attribute yet", () => {
    // Matches this app's original, dark-only look — see index.html's own
    // `:not([data-theme="light"])` fallback for the same reasoning applied to the
    // pre-mount CSS this component's colors are meant to match.
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    const heading = screen.getByText("Something went wrong");
    expect(heading.parentElement).toHaveStyle({ backgroundColor: "#0f0c0b", color: "#fff" });
  });

  it("renders with the light fallback colors when <html data-theme='light'> is set", () => {
    // Set the same way `renderer/public/theme-init.js` sets it in the real app,
    // before React ever mounts — regression test for the bug where this screen was
    // unconditionally dark regardless of the user's actual persisted theme.
    document.documentElement.dataset.theme = "light";

    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    const heading = screen.getByText("Something went wrong");
    expect(heading.parentElement).toHaveStyle({ backgroundColor: "#faf8f5", color: "#1a120c" });
  });

  it("reloads the page when the Reload button is clicked", () => {
    // jsdom's `window.location.reload` isn't directly spy-able (its property
    // descriptor isn't configurable) — replacing the whole `location` object with a
    // fresh, configurable one (restored afterward) is the standard workaround.
    // Deliberately not spreading the original `Location` instance (it's a real class
    // instance, not a plain object — spreading it would silently drop its prototype)
    // — a bare `{ reload }` is all this component (or this test) actually touches.
    const originalLocation = window.location;
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    try {
      render(
        <ErrorBoundary>
          <Bomb shouldThrow />
        </ErrorBoundary>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Reload" }));

      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });
});
