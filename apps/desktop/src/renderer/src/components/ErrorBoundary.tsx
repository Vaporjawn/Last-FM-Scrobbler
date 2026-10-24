import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorBoundaryFallback } from "./ErrorBoundaryFallback.js";

/** Props for `ErrorBoundary`: the subtree whose render-time errors it should catch. */
export interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

/** State for `ErrorBoundary`: the caught error, or `undefined` while the subtree is healthy. */
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

  /**
   * React calls this during rendering after a descendant throws; the returned state flips
   * `render` over to the fallback screen on the very next pass, before any commit.
   */
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  /** Logs the caught error and the React component stack that led to it to the console. */
  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // React already logs its own "An error occurred in the <X> component" message
    // with the component stack — this adds one explicit, greppable line rather than
    // relying entirely on that formatting, in case a future logging/telemetry sink
    // (e.g. Application Insights, mentioned in this app's own enterprise standards)
    // ever needs a single call site to hook into.
    console.error("ErrorBoundary caught an error:", error, errorInfo.componentStack);
  }

  /** Renders the children untouched until an error is caught, then the fallback screen. */
  public override render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return <ErrorBoundaryFallback error={error} />;
  }
}
