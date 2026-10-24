import { type JSX } from "react";
import { resolveErrorBoundaryColors } from "./resolve-error-boundary-colors.js";

export function ErrorBoundaryFallback({ error }: { readonly error: Error }): JSX.Element {
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
