import { Component, type ErrorInfo, type JSX, type ReactNode } from "react";
import { resolveErrorBoundaryColors } from "./resolve-error-boundary-colors.js";

export interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | undefined;
}

/**
 * Catches any otherwise-uncaught error thrown while rendering, committing, or in a
 * lifecycle method anywhere in `children` — error boundaries can only be class
 * components, there's no hook equivalent — and replaces the crashed subtree with a
 * plain "something went wrong" screen offering a reload, instead of leaving the whole
 * app a blank screen with nothing but a browser-console stack trace to go on. Mounted
 * once, wrapping everything, in `main.tsx`.
 *
 * Deliberately styled with inline CSS rather than MUI components: this sits above
 * `App`'s own `ThemeProvider` specifically so it can also catch errors thrown
 * *before* that provider mounts (e.g. `SettingsProvider` itself, which `App`'s theme
 * depends on) — MUI's theme context isn't guaranteed to be available at the point
 * this fallback renders, so it can't safely use `sx`/MUI components itself. Still
 * honors the user's real light/dark choice despite that: see
 * `ErrorBoundaryFallback`'s own comment for how.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = { error: undefined };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // React already logs its own "An error occurred in the <X> component" message
    // with the component stack — this adds one explicit, greppable line rather than
    // relying entirely on that formatting, in case a future logging/telemetry sink
    // (e.g. Application Insights, mentioned in this app's own enterprise standards)
    // ever needs a single call site to hook into.
    console.error("ErrorBoundary caught an error:", error, errorInfo.componentStack);
  }

  public override render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return <ErrorBoundaryFallback error={error} />;
  }
}

function ErrorBoundaryFallback({ error }: { readonly error: Error }): JSX.Element {
  // Reads the same `data-theme` attribute `renderer/public/theme-init.js` sets on
  // `<html>` before React ever mounts (see `renderer/index.html`) — not React
  // context/MUI's theme, which (per this component's own docstring) aren't
  // guaranteed to exist by the time this fallback renders. `document.documentElement`
  // itself always exists by React render time regardless of what crashed, so this is
  // a safe, real read of the user's actual persisted `AppSettings.themeMode`, not a
  // guess — previously this screen was unconditionally dark, wrong for every
  // light-mode user.
  const colors = resolveErrorBoundaryColors(document.documentElement.dataset.theme === "light");

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 32,
        textAlign: "center",
        background: colors.background,
        color: colors.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 20 }}>Something went wrong</h1>
      <p style={{ margin: 0, color: colors.subtleText, maxWidth: 480 }}>
        Last.fm Scrobbler ran into an unexpected error and couldn't continue. Reloading usually
        fixes it — your login and settings are safe either way.
      </p>
      <pre
        style={{
          margin: 0,
          maxWidth: 560,
          maxHeight: 160,
          overflow: "auto",
          padding: 12,
          borderRadius: 4,
          background: colors.panelBackground,
          color: colors.panelText,
          fontSize: 12,
          textAlign: "left",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {error.message}
      </pre>
      <button
        type="button"
        onClick={() => {
          window.location.reload();
        }}
        style={{
          padding: "8px 20px",
          borderRadius: 4,
          border: "none",
          background: "#d51007",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Reload
      </button>
    </div>
  );
}
