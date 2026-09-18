import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { SettingsProvider } from "./contexts/SettingsProvider.js";
import { TrayPopover } from "./TrayPopover.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

/**
 * The tray mini-player popover loads this exact same bundle in its own window (see
 * create-tray-popover-window.ts), distinguished only by a `#tray-popover` URL hash —
 * avoids standing up a second electron-vite renderer entry point purely for one small
 * view. Only `App` gets wrapped in `SettingsProvider` — `TrayPopover` is a genuinely
 * separate window/React tree with no context to share across that boundary, so it
 * reads settings state directly instead (see `useSettingsState`'s own docstring).
 */
function Root(): JSX.Element {
  if (window.location.hash === "#tray-popover") {
    return <TrayPopover />;
  }
  return (
    <SettingsProvider>
      <App />
    </SettingsProvider>
  );
}

// Wraps the whole tree (both branches of Root, above) — see ErrorBoundary's own
// docstring for why it sits outside SettingsProvider specifically: an error thrown by
// SettingsProvider itself (or anything App depends on before its own ThemeProvider
// mounts) still needs to be caught, not just errors from deeper in the tree.
createRoot(container).render(
  <ErrorBoundary>
    <Root />
  </ErrorBoundary>,
);
